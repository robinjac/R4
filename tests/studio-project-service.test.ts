import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { R4_STUDIO_PROJECT_COMPILER_PROFILE } from '../src/studio/compiler-profile.js';
import { createStudioSetPropertyIntent } from '../src/studio/intents.js';
import { createStudioNodeRef, findStudioNodeAtOffset } from '../src/studio/selection.js';
import { StudioProjectService, StudioProjectServiceError } from '../tools/studio-project-service.js';

const roots: string[] = [];
const pageSource = `<script>import { Page, Text } from 'r4';</script>\n<Page title="Service"><Text>Current</Text></Page>\n`;

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('R4 Studio project service', () => {
	test('discovers regular project documents without following generated folders or symlinks', async () => {
		const root = await workspace();
		await mkdir(join(root, 'src', 'nested'), { recursive: true });
		await mkdir(join(root, 'node_modules', 'ignored'), { recursive: true });
		await writeFile(join(root, 'src', 'App.r4.svelte'), pageSource);
		await writeFile(join(root, 'src', 'nested', 'detail.r4.svelte'), pageSource.replace('Current', 'Detail'));
		await writeFile(join(root, 'src', 'ignored.svelte'), pageSource);
		await writeFile(join(root, 'node_modules', 'ignored', 'package.r4.svelte'), pageSource);
		const outside = await workspace();
		await writeFile(join(outside, 'escape.r4.svelte'), pageSource);
		await symlink(join(outside, 'escape.r4.svelte'), join(root, 'src', 'escape.r4.svelte'));

		const service = await StudioProjectService.create({ workspaceRoot: root, viteRoot: root });
		const connected = service.connect(1);

		expect(connected.workspace).toMatchObject({ preview: 'repository', capabilities: { read: true, watch: true, write: true } });
		expect(connected.documents.map((document) => document.id)).toEqual(['src/App.r4.svelte', 'src/nested/detail.r4.svelte']);
		expect(connected.issues).toEqual([]);
	});

	test('returns revision-qualified snapshots under the project compiler profile', async () => {
		const root = await workspace();
		await mkdir(join(root, 'src'), { recursive: true });
		await writeFile(join(root, 'src', 'App.r4.svelte'), pageSource);
		const service = await StudioProjectService.create({ workspaceRoot: root, viteRoot: root });
		const document = service.documents[0];
		const response = await service.read(2, service.sessionId, document.id, document.revision);

		expect(response.type).toBe('snapshot');
		if (response.type !== 'snapshot') throw new Error('Expected a project snapshot');
		expect(response.snapshot).toMatchObject({
			version: 2,
			document: { id: 'src/App.r4.svelte', revision: document.revision },
			compilerProfile: R4_STUDIO_PROJECT_COMPILER_PROFILE
		});
		expect(response.snapshot.source).toBe(pageSource);
		expect(response.snapshot.compilation.ir?.root[0]).toMatchObject({ kind: 'element', primitive: 'Page' });
	});

	test('detects an external revision before returning a snapshot', async () => {
		const root = await workspace();
		await mkdir(join(root, 'src'), { recursive: true });
		const file = join(root, 'src', 'App.r4.svelte');
		await writeFile(file, pageSource);
		const service = await StudioProjectService.create({ workspaceRoot: root, viteRoot: root });
		const first = service.documents[0];
		const changes: string[][] = [];
		service.subscribe((change) => changes.push(change.documents.map((document) => document.revision)));

		await writeFile(file, pageSource.replace('Current', 'Externally changed'));
		const stale = await service.read(3, service.sessionId, first.id, first.revision);

		expect(stale).toMatchObject({ type: 'stale', expectedRevision: first.revision });
		if (stale.type !== 'stale') throw new Error('Expected a stale project response');
		expect(stale.current.revision).not.toBe(first.revision);
		expect(changes).toHaveLength(1);

		const current = await service.read(4, service.sessionId, first.id, stale.current.revision);
		expect(current.type).toBe('snapshot');
		if (current.type === 'snapshot') expect(current.snapshot.source).toContain('Externally changed');
	});

	test('rejects traversal, stale sessions, and unindexed files', async () => {
		const root = await workspace();
		await mkdir(join(root, 'src'), { recursive: true });
		await writeFile(join(root, 'src', 'App.r4.svelte'), pageSource);
		await writeFile(join(root, 'src', 'plain.txt'), pageSource);
		const service = await StudioProjectService.create({ workspaceRoot: root, viteRoot: root });

		await expect(service.read(5, service.sessionId, '../escape.r4.svelte')).rejects.toMatchObject({ code: 'invalid-document' });
		await expect(service.read(6, 'old-session', 'src/App.r4.svelte')).rejects.toMatchObject({ code: 'invalid-session' });
		await expect(service.read(7, service.sessionId, 'src/missing.r4.svelte')).rejects.toMatchObject({ code: 'document-not-found' });
		await expect(service.read(8, service.sessionId, 'src/plain.txt')).rejects.toBeInstanceOf(StudioProjectServiceError);
	});

	test('marks separately approved workspaces as analysis-only', async () => {
		const root = await workspace();
		const viteRoot = await workspace();
		await writeFile(join(root, 'External.r4.svelte'), pageSource);
		const service = await StudioProjectService.create({ workspaceRoot: root, viteRoot });

		expect(service.workspace.preview).toBe('none');
	});

	test('replans property edits against disk and supports exact service undo', async () => {
		const root = await workspace();
		await mkdir(join(root, 'src'), { recursive: true });
		const file = join(root, 'src', 'App.r4.svelte');
		await writeFile(file, pageSource);
		const service = await StudioProjectService.create({ workspaceRoot: root, viteRoot: root });
		const document = service.documents[0];
		const read = await service.read(9, service.sessionId, document.id, document.revision);
		if (read.type !== 'snapshot') throw new Error('Expected a project snapshot');
		const page = findStudioNodeAtOffset(read.snapshot, pageSource.indexOf('<Page') + 1);
		if (!page) throw new Error('Expected a Page node');

		const changed = await service.applyIntent(
			10,
			service.sessionId,
			document.id,
			createStudioSetPropertyIntent(
				createStudioNodeRef(read.snapshot, page.id),
				'title',
				'Changed by Studio',
				{ type: 'inspector' },
				'service-title'
			)
		);
		expect(changed).toMatchObject({ type: 'mutation', status: 'applied' });
		if (changed.type !== 'mutation' || changed.status !== 'applied') throw new Error('Expected an applied mutation');
		expect(await readFile(file, 'utf8')).toBe(pageSource.replace('title="Service"', 'title="Changed by Studio"'));

		const restored = await service.applyHistory(11, service.sessionId, document.id, changed.applied.undo, 'undo');
		expect(restored).toMatchObject({ type: 'mutation', status: 'applied' });
		expect(await readFile(file, 'utf8')).toBe(pageSource);
	});

	test('rejects a property intent after an external edit without overwriting it', async () => {
		const root = await workspace();
		await mkdir(join(root, 'src'), { recursive: true });
		const file = join(root, 'src', 'App.r4.svelte');
		await writeFile(file, pageSource);
		const service = await StudioProjectService.create({ workspaceRoot: root, viteRoot: root });
		const document = service.documents[0];
		const read = await service.read(12, service.sessionId, document.id, document.revision);
		if (read.type !== 'snapshot') throw new Error('Expected a project snapshot');
		const page = findStudioNodeAtOffset(read.snapshot, pageSource.indexOf('<Page') + 1);
		if (!page) throw new Error('Expected a Page node');
		const external = pageSource.replace('Current', 'External owner');
		await writeFile(file, external);

		const conflict = await service.applyIntent(
			13,
			service.sessionId,
			document.id,
			createStudioSetPropertyIntent(
				createStudioNodeRef(read.snapshot, page.id),
				'title',
				'Must not win',
				{ type: 'inspector' },
				'stale-service-title'
			)
		);
		expect(conflict).toMatchObject({ type: 'conflict', expected: read.snapshot.document });
		expect(await readFile(file, 'utf8')).toBe(external);
	});

	test('deduplicates in-flight and completed intents while keeping audit metadata value-free', async () => {
		const { service, document, read, page, file } = await editableService();
		const changes: Array<{ transactionId?: string }> = [];
		service.subscribe((change) => changes.push({ transactionId: change.cause?.transactionId }));
		const intent = createStudioSetPropertyIntent(
			createStudioNodeRef(read.snapshot, page.id),
			'title',
			'Idempotent value',
			{ type: 'canvas', runtimeInstance: { artifactId: 'artifact-1', instanceId: 'instance-1' } },
			'idempotent-title'
		);

		const applying = service.applyIntent(20, service.sessionId, document.id, intent);
		const lookingUp = service.lookupIntent(21, service.sessionId, document.id, intent);
		const [applied, pendingLookup] = await Promise.all([applying, lookingUp]);
		const reconciled = await service.lookupIntent(21, service.sessionId, document.id, intent);
		const duplicate = await service.applyIntent(22, service.sessionId, document.id, intent);

		expect(applied).toMatchObject({ type: 'mutation', status: 'applied', audit: { sequence: 1, origin: { type: 'canvas' } } });
		expect(pendingLookup).toMatchObject({ type: 'intent-pending', requestId: 21, intentId: 'idempotent-title' });
		expect(reconciled).toMatchObject({ type: 'reconciliation', requestId: 21, result: { type: 'mutation', status: 'applied', audit: { sequence: 1 } } });
		expect(duplicate).toMatchObject({ type: 'mutation', status: 'applied', requestId: 22, audit: { sequence: 1 } });
		expect(changes).toEqual([{ transactionId: 'idempotent-title' }]);
		expect(await readFile(file, 'utf8')).toContain('title="Idempotent value"');

		const reused = await service.applyIntent(23, service.sessionId, document.id, {
			...intent,
			operation: { ...intent.operation, value: 'Different payload' }
		});
		expect(reused).toMatchObject({ type: 'rejected', code: 'intent-id-reused', audit: { sequence: 2 } });
		const records = service.readAudit(24, service.sessionId).records;
		expect(records).toHaveLength(2);
		expect(JSON.stringify(records)).not.toContain('Idempotent value');
		expect(JSON.stringify(records)).not.toContain('Different payload');

		if (applied.type !== 'mutation' || applied.status !== 'applied') throw new Error('Expected an applied mutation');
		const nextPage = findStudioNodeAtOffset(applied.applied.snapshot, applied.applied.snapshot.source.indexOf('<Page') + 1);
		if (!nextPage) throw new Error('Expected the edited Page node');
		const newer = await service.applyIntent(
			25,
			service.sessionId,
			document.id,
			createStudioSetPropertyIntent(
				createStudioNodeRef(applied.applied.snapshot, nextPage.id),
				'title',
				'Newer value',
				{ type: 'inspector' },
				'newer-title'
			)
		);
		expect(newer).toMatchObject({ type: 'mutation', status: 'applied' });
		if (newer.type !== 'mutation' || newer.status !== 'applied') throw new Error('Expected a newer applied mutation');
		const superseded = await service.applyIntent(26, service.sessionId, document.id, intent);
		expect(superseded).toMatchObject({ type: 'rejected', code: 'intent-result-superseded' });
		const historical = await service.lookupIntent(27, service.sessionId, document.id, intent);
		expect(historical).toMatchObject({ type: 'intent-missing', intentId: intent.id });
		expect(await readFile(file, 'utf8')).toContain('title="Newer value"');
	});

	test('does not consume an intent ID when the request route targets another document', async () => {
		const { service, document, read, page, file } = await editableService();
		const intent = createStudioSetPropertyIntent(
			createStudioNodeRef(read.snapshot, page.id),
			'title',
			'Correct route',
			{ type: 'automation', runId: 'route-test' },
			'route-bound-title'
		);

		const mismatch = await service.applyIntent(25, service.sessionId, 'src/Other.r4.svelte', intent);
		expect(mismatch).toMatchObject({ type: 'rejected', code: 'document-mismatch' });
		const applied = await service.applyIntent(26, service.sessionId, document.id, intent);
		expect(applied).toMatchObject({ type: 'mutation', status: 'applied' });
		expect(await readFile(file, 'utf8')).toContain('title="Correct route"');
	});

	test('validates, deduplicates, and reconciles service-issued history capabilities', async () => {
		const { service, document, read, page, file } = await editableService();
		const historyIntent = createStudioSetPropertyIntent(
			createStudioNodeRef(read.snapshot, page.id),
			'title',
			'History value',
			{ type: 'inspector' },
			'history-title'
		);
		const changed = await service.applyIntent(
			30,
			service.sessionId,
			document.id,
			historyIntent
		);
		if (changed.type !== 'mutation' || changed.status !== 'applied') throw new Error('Expected an applied mutation');
		expect(changed.applied.undo.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(changed.applied.undo.label).toBe('Undo Set title');

		const wrongDirection = await service.applyHistory(31, service.sessionId, document.id, changed.applied.undo, 'redo');
		expect(wrongDirection).toMatchObject({ type: 'rejected', code: 'invalid-history' });
		const tampered = await service.applyHistory(
			32,
			service.sessionId,
			document.id,
			{ ...changed.applied.undo, edits: [{ ...changed.applied.undo.edits[0], replacement: 'tampered' }] },
			'undo'
		);
		expect(tampered).toMatchObject({ type: 'rejected', code: 'invalid-history' });

		const restoring = service.applyHistory(33, service.sessionId, document.id, changed.applied.undo, 'undo');
		const lookingUp = service.lookupHistory(34, service.sessionId, document.id, changed.applied.undo, 'undo');
		const [restored, pendingLookup] = await Promise.all([restoring, lookingUp]);
		const reconciled = await service.lookupHistory(34, service.sessionId, document.id, changed.applied.undo, 'undo');
		expect(restored).toMatchObject({ type: 'mutation', status: 'applied', audit: { operation: 'undo' } });
		if (restored.type !== 'mutation' || restored.status !== 'applied') throw new Error('Expected an applied undo');
		expect(restored.applied.undo.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(restored.applied.undo.label).toBe('Redo Set title');
		expect(pendingLookup).toMatchObject({ type: 'history-pending', requestId: 34 });
		expect(reconciled).toMatchObject({ type: 'reconciliation', requestId: 34, result: { type: 'mutation', status: 'applied' } });
		const duplicate = await service.applyHistory(35, service.sessionId, document.id, changed.applied.undo, 'undo');
		expect(duplicate).toMatchObject({ type: 'mutation', status: 'applied', requestId: 35 });
		expect(await readFile(file, 'utf8')).toBe(pageSource);

		const malformed = await service.applyHistory(36, service.sessionId, document.id, { id: 'x'.repeat(10_000) }, 'undo');
		expect(malformed).toMatchObject({ type: 'rejected', code: 'invalid-history', audit: { operation: 'invalid', origin: { type: 'unknown' } } });
		expect(JSON.stringify(service.readAudit(37, service.sessionId).records)).not.toContain('xxxxxxxxxxxxxxxx');

		const redone = await service.applyHistory(38, service.sessionId, document.id, restored.applied.undo, 'redo');
		expect(redone).toMatchObject({ type: 'mutation', status: 'applied' });
		const spentResult = await service.applyIntent(39, service.sessionId, document.id, historyIntent);
		expect(spentResult).toMatchObject({ type: 'rejected', code: 'intent-result-superseded' });
	});

	test('retains a stale history conflict for response-loss reconciliation', async () => {
		const { service, document, read, page, file } = await editableService();
		const changed = await service.applyIntent(
			40,
			service.sessionId,
			document.id,
			createStudioSetPropertyIntent(
				createStudioNodeRef(read.snapshot, page.id),
				'title',
				'Before external change',
				{ type: 'inspector' },
				'conflicted-history'
			)
		);
		if (changed.type !== 'mutation' || changed.status !== 'applied') throw new Error('Expected an applied mutation');
		await writeFile(file, changed.applied.snapshot.source.replace('Current', 'External owner'));

		const conflict = await service.applyHistory(41, service.sessionId, document.id, changed.applied.undo, 'undo');
		expect(conflict).toMatchObject({ type: 'conflict', audit: { operation: 'undo' } });
		const reconciled = await service.lookupHistory(42, service.sessionId, document.id, changed.applied.undo, 'undo');
		expect(reconciled).toMatchObject({ type: 'reconciliation', result: { type: 'conflict' } });
		const duplicate = await service.applyHistory(43, service.sessionId, document.id, changed.applied.undo, 'undo');
		expect(duplicate).toMatchObject({ type: 'conflict', requestId: 43 });
		expect(await readFile(file, 'utf8')).toContain('External owner');
	});

	test('does not publish an uncaused rescan between concurrent Studio transactions', async () => {
		const root = await workspace();
		await mkdir(join(root, 'src'), { recursive: true });
		await writeFile(join(root, 'src', 'A.r4.svelte'), pageSource);
		await writeFile(join(root, 'src', 'B.r4.svelte'), pageSource.replace('Service', 'Second'));
		const service = await StudioProjectService.create({ workspaceRoot: root, viteRoot: root });
		const [documentA, documentB] = service.documents;
		const [readA, readB] = await Promise.all([
			service.read(50, service.sessionId, documentA.id, documentA.revision),
			service.read(51, service.sessionId, documentB.id, documentB.revision)
		]);
		if (readA.type !== 'snapshot' || readB.type !== 'snapshot') throw new Error('Expected project snapshots');
		const pageA = findStudioNodeAtOffset(readA.snapshot, readA.snapshot.source.indexOf('<Page') + 1);
		const pageB = findStudioNodeAtOffset(readB.snapshot, readB.snapshot.source.indexOf('<Page') + 1);
		if (!pageA || !pageB) throw new Error('Expected Page nodes');
		const changes: Array<{ transactionId?: string }> = [];
		let overlappingRescan: Promise<boolean> | null = null;
		service.subscribe((change) => {
			changes.push({ transactionId: change.cause?.transactionId });
			if (!overlappingRescan) overlappingRescan = service.rescan(true);
		});

		const [changedA, changedB] = await Promise.all([
			service.applyIntent(52, service.sessionId, documentA.id, createStudioSetPropertyIntent(
				createStudioNodeRef(readA.snapshot, pageA.id), 'title', 'Changed A', { type: 'inspector' }, 'change-a'
			)),
			service.applyIntent(53, service.sessionId, documentB.id, createStudioSetPropertyIntent(
				createStudioNodeRef(readB.snapshot, pageB.id), 'title', 'Changed B', { type: 'inspector' }, 'change-b'
			))
		]);
		if (overlappingRescan) await overlappingRescan;

		expect(changedA).toMatchObject({ type: 'mutation', status: 'applied' });
		expect(changedB).toMatchObject({ type: 'mutation', status: 'applied' });
		expect(changes).toHaveLength(2);
		expect(changes.every((change) => change.transactionId === 'change-a' || change.transactionId === 'change-b')).toBe(true);
	});

	test('keeps only the latest 100 sanitized audit records', async () => {
		const { service, document } = await editableService();
		for (let index = 0; index < 105; index += 1) {
			await service.applyIntent(100 + index, service.sessionId, document.id, {
				schema: 'invalid',
				secret: `source-value-${index}`
			});
		}
		const records = service.readAudit(300, service.sessionId).records;
		expect(records).toHaveLength(100);
		expect(records[0]?.sequence).toBe(6);
		expect(records.at(-1)?.sequence).toBe(105);
		expect(JSON.stringify(records)).not.toContain('source-value');
	});
});

async function editableService() {
	const root = await workspace();
	await mkdir(join(root, 'src'), { recursive: true });
	const file = join(root, 'src', 'App.r4.svelte');
	await writeFile(file, pageSource);
	const service = await StudioProjectService.create({ workspaceRoot: root, viteRoot: root });
	const document = service.documents[0];
	const read = await service.read(19, service.sessionId, document.id, document.revision);
	if (read.type !== 'snapshot') throw new Error('Expected a project snapshot');
	const page = findStudioNodeAtOffset(read.snapshot, pageSource.indexOf('<Page') + 1);
	if (!page) throw new Error('Expected a Page node');
	return { service, document, read, page, file };
}

async function workspace(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'r4-studio-'));
	roots.push(root);
	return root;
}
