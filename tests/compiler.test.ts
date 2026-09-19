import { describe, expect, test } from 'bun:test';
import { compileR4, type R4Node } from '../src/lib/compiler/index.js';

const counter = `<script lang="ts">
  import { Button, Stack, Text } from '$lib/index.js';
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>

<Stack gap="md">
  <Text>Count: {count}</Text>
  <Text>Doubled: {doubled}</Text>
  <Button onclick={() => count++}><Text>Increment</Text></Button>
</Stack>`;

describe('R4 compiler', () => {
	test('extracts semantic nodes and compiler-known update edges', () => {
		const result = compileR4(counter, { filename: 'counter.r4.svelte' });
		expect(result.diagnostics).toEqual([]);
		expect(result.ir).not.toBeNull();

		const ir = result.ir!;
		expect(ir.source.runes).toBe(true);
		expect(ir.state.map(({ name, kind }) => ({ name, kind }))).toEqual([
			{ name: 'count', kind: 'state' },
			{ name: 'doubled', kind: 'derived' }
		]);
		expect(ir.updates).toContainEqual({ from: 'count', to: 'doubled', kind: 'recompute' });
		expect(ir.updates.filter((edge) => edge.kind === 'text').map((edge) => edge.from)).toEqual(['count', 'doubled']);

		const button = flatten(ir.root).find((node) => node.kind === 'element' && node.primitive === 'Button');
		expect(button?.kind).toBe('element');
		if (button?.kind !== 'element') throw new Error('Button was not compiled');
		expect(button.domain).toBe('action');
		expect(button.intent).toBe('activate');
		expect(button.props.activation).toMatchObject({
			kind: 'handler',
			parameters: [],
			reads: ['count'],
			writes: ['count'],
			mutations: [{ target: 'count', operator: 'increment' }]
		});
	});

	test('resolves aliases from primitive imports', () => {
		const result = compileR4(`<script>import { Button as Action } from 'r4';</script><Action>Save</Action>`);
		expect(result.ir?.root[0]).toMatchObject({ kind: 'element', primitive: 'Button', intent: 'activate' });
	});

	test('reports ambiguous interaction semantics across platforms', () => {
		const result = compileR4(
			`<script>import { View, Text } from '$lib/index.js'; let open = $state(false);</script><View onclick={() => open = !open}><Text>Open</Text></View>`
		);
		const diagnostic = result.diagnostics.find((item) => item.code === 'r4/interactive-view');
		expect(diagnostic?.severity).toBe('warning');
		expect(diagnostic?.platforms).toEqual(['web', 'ios', 'android', 'macos', 'windows']);
	});

	test('fails closed for raw platform elements', () => {
		const result = compileR4('<button>Save</button>');
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'r4/platform-element', severity: 'error' })
		);
	});

	test('tracks all expression references separately from reactive dependencies', () => {
		const result = compileR4(`<script>
      import { Text } from 'r4';
      import { format } from './format.js';
      let count = $state(1);
      let label = $derived(format(count));
    </script><Text>{label}</Text>`);
		const label = result.ir?.state.find((binding) => binding.name === 'label');
		expect(label?.value).toMatchObject({ references: ['count', 'format'], dependencies: ['count'] });
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'r4/unresolved-expression-reference', severity: 'error' })
		);
	});

	test('does not replay conditional or shadowed state mutations', () => {
		const conditional = compileR4(`<script>
      import { Button } from 'r4';
      let count = $state(0);
      function update() { if (count > 0) count++; }
    </script><Button onclick={update}>Update</Button>`);
		const conditionalButton = conditional.ir?.root[0];
		expect(conditionalButton?.kind).toBe('element');
		if (conditionalButton?.kind !== 'element') throw new Error('Button was not compiled');
		expect(conditionalButton.props.activation).toMatchObject({ writes: [], mutations: [] });
		expect(conditional.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'r4/unsupported-handler-control-flow', severity: 'error' })
		);

		const shadowed = compileR4(`<script>
      import { Button } from 'r4';
      let count = $state(0);
      function update(count) { count++; }
    </script><Button onclick={update}>Update</Button>`);
		const shadowedButton = shadowed.ir?.root[0];
		expect(shadowedButton?.kind).toBe('element');
		if (shadowedButton?.kind !== 'element') throw new Error('Button was not compiled');
		expect(shadowedButton.props.activation).toMatchObject({ parameters: ['count'], writes: [], mutations: [] });
	});

	test('rejects dropped handler statements and ambiguous mutation ordering', () => {
		const sideEffect = compileR4(`<script>
      import { Button } from 'r4';
      let count = $state(0);
      function update() { const request = fetch('/audit'); count++; }
    </script><Button onclick={update}>Update</Button>`);
		expect(sideEffect.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'r4/unsupported-handler-control-flow', severity: 'error' })
		);
		const sideEffectButton = sideEffect.ir?.root[0];
		expect(sideEffectButton?.kind).toBe('element');
		if (sideEffectButton?.kind !== 'element') throw new Error('Button was not compiled');
		expect(sideEffectButton.props.activation).toMatchObject({ writes: [], mutations: [] });

		const ordered = compileR4(`<script>
      import { Button } from 'r4';
      let first = $state(0);
      let second = $state(0);
      function update() { first = 1; second = first; }
    </script><Button onclick={update}>Update</Button>`);
		const button = ordered.ir?.root[0];
		expect(button?.kind).toBe('element');
		if (button?.kind !== 'element') throw new Error('Button was not compiled');
		expect(button.props.activation).toMatchObject({ writes: [], mutations: [] });
		expect(ordered.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'r4/multiple-handler-mutations', severity: 'error' })
		);
	});

	test('reports unsupported rune variants instead of dropping their declarations', () => {
		const result = compileR4(`<script>import { Text } from 'r4'; let items = $state.raw([]);</script><Text>{items.length}</Text>`);
		expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'r4/unsupported-rune', severity: 'error' }));
	});

	test('keeps semantic requirements independent from renderer brands', () => {
		const result = compileR4(`<script>import { Image, Input, Link } from 'r4';</script>
      <Image src="photo.jpg" alt="Portrait" />
      <Input label="Name" />
      <Link href="/next">Next</Link>`);
		expect(result.ir?.requirements).toEqual(['image-loading', 'navigation', 'text-input']);
	});

	test('rejects empty control names and preserves non-JSON expressions as source', () => {
		const names = compileR4(`<script>import { Button, Input, View } from 'r4';</script>
      <Input label="" />
      <Button label=""><View /></Button>`);
		expect(names.diagnostics).toContainEqual(expect.objectContaining({ code: 'r4/input-label-required', severity: 'error' }));
		expect(names.diagnostics).toContainEqual(expect.objectContaining({ code: 'r4/action-name-required', severity: 'error' }));

		const values = compileR4(`<script>import { Text } from 'r4'; const sparse = [,,]; const huge = 1e400;</script><Text>Values</Text>`);
		expect(values.ir?.state.find((binding) => binding.name === 'sparse')?.value).toMatchObject({ kind: 'expression', source: '[,,]' });
		expect(values.ir?.state.find((binding) => binding.name === 'huge')?.value).toMatchObject({ kind: 'expression', source: '1e400' });
	});
});

function flatten(nodes: R4Node[]): R4Node[] {
	return nodes.flatMap((node) => {
		if (node.kind === 'element') return [node, ...flatten(node.children)];
		if (node.kind === 'if') return [node, ...flatten(node.consequent), ...flatten(node.alternate)];
		if (node.kind === 'each') return [node, ...flatten(node.children), ...flatten(node.fallback)];
		return [node];
	});
}
