import { describe, expect, test } from 'bun:test';
import { compileR4, type R4Node } from '../src/lib/compiler/index.js';
import { isPrimitiveName } from '../src/lib/manifest.js';
import { analyzeStudioSource, MAX_STUDIO_SOURCE_LENGTH } from '../src/studio/analyze.js';
import { applyStudioSourceTransaction, R4_STUDIO_EDIT_VERSION, type R4StudioSourceTransaction } from '../src/studio/contracts.js';
import { createStudioNodeRef, findStudioNodeAtOffset, resolveStudioNode, sourceForStudioNode } from '../src/studio/selection.js';

const studioSource = `<script lang="ts">
	import { Button, Page, Text } from 'r4';
	let count = $state(0);
</script>

<Page title="Studio test">
	<Text>Count: {count}</Text>
	<Button onclick={() => count++}>Increment</Button>
</Page>`;

describe('R4 Studio contracts', () => {
	test('creates deterministic revision-qualified compiler snapshots', async () => {
		const first = await analyzeStudioSource(studioSource, 'src/StudioTest.r4.svelte');
		const second = await analyzeStudioSource(studioSource, 'src/StudioTest.r4.svelte');
		const changed = await analyzeStudioSource(`${studioSource}\n`, 'src/StudioTest.r4.svelte');

		expect(first).toMatchObject({
			schema: 'r4.studio.snapshot',
			version: 1,
			document: { id: 'src/StudioTest.r4.svelte' }
		});
		expect(first.document.revision).toHaveLength(64);
		expect(second.document.revision).toBe(first.document.revision);
		expect(changed.document.revision).not.toBe(first.document.revision);
		expect(flatten(first.compilation.ir?.root ?? []).some((node) => node.kind === 'element' && node.primitive === 'Button')).toBe(true);
	});

	test('keeps invalid source as an inspectable failed snapshot', async () => {
		const snapshot = await analyzeStudioSource('<Page title="Broken">', 'src/Broken.r4.svelte');

		expect(snapshot.source).toBe('<Page title="Broken">');
		expect(snapshot.compilation.ir).toBeNull();
		expect(snapshot.compilation.ast).toBeNull();
		expect(snapshot.compilation.diagnostics).toContainEqual(expect.objectContaining({ severity: 'error' }));
	});

	test('rejects source beyond the browser analysis limit', async () => {
		expect(analyzeStudioSource('x'.repeat(MAX_STUDIO_SOURCE_LENGTH + 1))).rejects.toThrow('character limit');
	});

	test('applies atomic source transactions and generates an exact undo', async () => {
		const snapshot = await analyzeStudioSource(studioSource, 'src/StudioTest.r4.svelte');
		const titleStart = studioSource.indexOf('Studio test');
		const actionStart = studioSource.indexOf('Increment');
		const transaction: R4StudioSourceTransaction = {
			schema: 'r4.studio.source-transaction',
			version: R4_STUDIO_EDIT_VERSION,
			id: 'rename-action',
			document: snapshot.document,
			label: 'Rename action',
			edits: [
				{ start: titleStart, end: titleStart + 'Studio test'.length, replacement: 'Studio contract test' },
				{ start: actionStart, end: actionStart + 'Increment'.length, replacement: 'Add one' }
			]
		};

		const applied = await applyStudioSourceTransaction(snapshot, transaction);
		expect(applied.snapshot.source).toContain('title="Studio contract test"');
		expect(applied.snapshot.source).toContain('>Add one</Button>');
		expect(applied.snapshot.document.revision).not.toBe(snapshot.document.revision);
		expect(applied.undo).toMatchObject({ reverses: transaction.id, document: applied.snapshot.document });

		const restored = await applyStudioSourceTransaction(applied.snapshot, applied.undo);
		expect(restored.snapshot.source).toBe(studioSource);
		expect(restored.snapshot.document.revision).toBe(snapshot.document.revision);
	});

	test('rejects stale, overlapping, and out-of-bounds transactions', async () => {
		const snapshot = await analyzeStudioSource(studioSource, 'src/StudioTest.r4.svelte');
		const base: R4StudioSourceTransaction = {
			schema: 'r4.studio.source-transaction',
			version: R4_STUDIO_EDIT_VERSION,
			id: 'invalid-edit',
			document: snapshot.document,
			label: 'Invalid edit',
			edits: [{ start: 0, end: 1, replacement: '' }]
		};

		expect(applyStudioSourceTransaction(snapshot, { ...base, document: { ...snapshot.document, revision: 'stale' } })).rejects.toThrow('stale');
		expect(
			applyStudioSourceTransaction(snapshot, {
				...base,
				edits: [
					{ start: 0, end: 4, replacement: '' },
					{ start: 3, end: 5, replacement: '' }
				]
			})
		).rejects.toThrow('overlap');
		expect(applyStudioSourceTransaction(snapshot, { ...base, edits: [{ start: 0, end: studioSource.length + 1, replacement: '' }] })).rejects.toThrow(
			'outside'
		);
	});

	test('resolves semantic selections only within their exact document revision', async () => {
		const snapshot = await analyzeStudioSource(studioSource, 'src/StudioTest.r4.svelte');
		const button = findStudioNodeAtOffset(snapshot, studioSource.indexOf('<Button') + 1);
		if (!button) throw new Error('Button selection was not resolved');
		const ref = createStudioNodeRef(snapshot, button.id);

		expect(button).toMatchObject({ kind: 'element', primitive: 'Button' });
		expect(resolveStudioNode(snapshot, ref)?.id).toBe(button.id);
		expect(sourceForStudioNode(snapshot, ref)).toBe('<Button onclick={() => count++}>Increment</Button>');

		const changed = await analyzeStudioSource(`${studioSource}\n`, 'src/StudioTest.r4.svelte');
		expect(resolveStudioNode(changed, ref)).toBeNull();
		expect(sourceForStudioNode(changed, ref)).toBeNull();
	});

	test('recognizes only manifest-owned primitive names', () => {
		expect(isPrimitiveName('Button')).toBe(true);
		expect(isPrimitiveName('constructor')).toBe(false);
		expect(isPrimitiveName('toString')).toBe(false);
	});
});

describe('R4 source provenance', () => {
	test('uses end-exclusive UTF-16 ranges and compilation-local unique node IDs', () => {
		const source = `<script>import { Page, Text } from 'r4';</script>\r\n<Page title="Range test">\r\n  <Text>😀 value</Text>\r\n</Page>`;
		const result = compileR4(source, { filename: 'range.r4.svelte', primitiveModules: ['r4'] });
		const nodes = flatten(result.ir?.root ?? []);
		const text = nodes.find((node) => node.kind === 'element' && node.primitive === 'Text');

		if (!text) throw new Error('Text node was not compiled');
		expect(source.slice(text.range.start.offset, text.range.end.offset)).toBe('<Text>😀 value</Text>');
		expect(text.range.start).toMatchObject({ line: 3, column: 2 });
		expect(text.range.end.offset).toBe(text.range.start.offset + '<Text>😀 value</Text>'.length);
		expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
	});
});

function flatten(nodes: R4Node[]): R4Node[] {
	return nodes.flatMap((node) => {
		if (node.kind === 'element' || node.kind === 'component') return [node, ...flatten(node.children)];
		if (node.kind === 'if') return [node, ...flatten(node.consequent), ...flatten(node.alternate)];
		if (node.kind === 'each') return [node, ...flatten(node.children), ...flatten(node.fallback)];
		return [node];
	});
}
