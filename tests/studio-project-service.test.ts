import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { R4_STUDIO_PROJECT_COMPILER_PROFILE } from '../src/studio/compiler-profile.js';
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

		expect(connected.workspace).toMatchObject({ preview: 'repository', capabilities: { read: true, watch: true, write: false } });
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
});

async function workspace(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'r4-studio-'));
	roots.push(root);
	return root;
}
