import { describe, expect, test } from 'bun:test';
import { lowerToLynx } from '../src/lib/backends/index.js';
import { compileR4 } from '../src/lib/compiler/index.js';

describe('Lynx backend', () => {
	test('lowers reactive R4 intent behind a replaceable backend contract', () => {
		const result = compileR4(`<script>
      import { Button, Text } from 'r4';
      let count = $state(0);
      let doubled = $derived(count * 2);
    </script>
    <Text>{count} / {doubled}</Text>
    <Button onclick={() => count++}><Text>Increment</Text></Button>`);

		if (!result.ir) throw new Error('Fixture did not compile');
		const artifact = lowerToLynx(result.ir);
		const generated = artifact.files[artifact.entry];

		expect(artifact.backend).toBe('lynx-react-adapter');
		expect(artifact.status).toBe('experimental');
		expect(generated).toContain(`const [count, setCount] = useState(0);`);
		expect(generated).toContain(`const doubled = count * 2;`);
		expect(generated).toContain(`setCount((value) => value + 1);`);
		expect(generated).toContain(`accessibility-traits="button"`);
		expect(artifact.diagnostics).toEqual([]);
		expect(artifact.requirements).toContain('lynx-engine>=3.9');
	});

	test('fails closed for effects, iteration, input, and dynamic style policy', () => {
		const result = compileR4(`<script>
      import { Grid, Input, Text, View } from 'r4';
      let active = $state(false);
      const items = ['one'];
      $effect(() => { active; });
    </script>
    <View background={active ? '#fff' : '#000'}>
      <Input label="Name" description="Public display name" />
      <Grid>{#each items as item}<Text>{item}</Text>{/each}</Grid>
    </View>`);

		if (!result.ir) throw new Error('Fixture did not compile');
		const artifact = lowerToLynx(result.ir);
		const codes = artifact.diagnostics.map((diagnostic) => diagnostic.code);
		expect(codes).toContain('r4/lynx-effect-unsupported');
		expect(codes).toContain('r4/lynx-each-unsupported');
		expect(codes).toContain('r4/lynx-primitive-unsupported');
		expect(codes).toContain('r4/lynx-dynamic-style-unsupported');
		expect(artifact.diagnostics.every((diagnostic) => diagnostic.severity === 'error')).toBe(true);
	});

	test('maps semantic capabilities to backend-specific requirements', () => {
		const result = compileR4(`<script>import { Input } from 'r4';</script><Input label="Name" />`);
		if (!result.ir) throw new Error('Fixture did not compile');
		const artifact = lowerToLynx(result.ir);
		expect(result.ir.requirements).toEqual(['text-input']);
		expect(artifact.requirements).toContain('lynx:xelement-input');
		expect(artifact.requirements).not.toContain('text-input');
	});

	test('escapes templates and preserves image and heading accessibility semantics', () => {
		const source = String.raw`<script>
      import { Button, Image, Text } from 'r4';
      let count = $state(0);
    </script>
    <Button label="C:\new tick__BACKTICK__ {count}" onclick={() => count++}>Update</Button>
    <Image src="divider.png" alt="" />
		<Text role="heading">Status</Text>`.replace('__BACKTICK__', '`');
		const result = compileR4(source);
		if (!result.ir) throw new Error('Fixture did not compile');
		const generated = lowerToLynx(result.ir).files['src/generated.tsx'];
		expect(generated).toContain('`C:\\\\new tick\\` ${count}`');
		expect(generated).toContain('accessibility-element={false}');
		expect(generated).toContain('accessibility-traits="header"');
	});
});
