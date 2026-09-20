import { describe, expect, test } from 'bun:test';
import { compile } from 'svelte/compiler';
import { compileR4 } from '../src/lib/compiler/index.js';
import { R4_STUDIO_PROJECT_COMPILER_PROFILE } from '../src/studio/compiler-profile.js';
import { createStudioArtifactId, instrumentStudioSource } from '../tools/studio-instrumentation.js';

const source = `<script module lang="ts">
\texport const fixture = true;
</script>

<script lang="ts">
\timport ImportedCard from './ImportedCard.svelte';
\timport { List, ListItem, Page, Text } from '$lib/index.js';
\tconst items = ['one', 'two'];
\tlet visible = true;
</script>

<Page title="Instrumentation">
\t{#if visible}
\t\t<List label="Items">
\t\t\t{#each items as item}
\t\t\t\t<ListItem><Text>{item}</Text></ListItem>
\t\t\t{/each}
\t\t</List>
\t{/if}
\t<ImportedCard />
</Page>
`;

describe('R4 Studio runtime instrumentation', () => {
	test('wraps exact semantic ranges in DOM-free runtime boundaries', () => {
		const filename = '/workspace/src/research/instrumentation.r4.svelte';
		const compilation = compileR4(source, {
			filename,
			primitiveModules: R4_STUDIO_PROJECT_COMPILER_PROFILE.primitiveModules
		});
		const expectedIds = flattenIds(compilation.ir?.root ?? []);
		const rootId = compilation.ir?.root[0]?.id;
		const result = instrumentStudioSource(source, filename);

		expect(result.nodeIds).toEqual(expectedIds);
		expect(result.code).toContain("import R4StudioRuntimeNode from \"/src/studio/StudioRuntimeNode.svelte\";");
		expect(result.code).toContain(`<R4StudioRuntimeNode artifactId="${result.artifactId}" nodeId="${rootId}"><Page`);
		expect(result.code).toContain('</Page></R4StudioRuntimeNode>');
		expect(result.code).not.toContain('r4-studio-runtime-node');
		expect(result.map.sources).toEqual([filename]);
		expect(result.map.sourcesContent).toEqual([source]);
		expect(() => compile(result.code, { filename, generate: 'client' })).not.toThrow();
	});

	test('keeps artifact identity deterministic and source-specific', () => {
		const filename = '/workspace/src/research/identity.r4.svelte';
		const first = createStudioArtifactId(source, filename);
		expect(createStudioArtifactId(source, filename)).toBe(first);
		expect(createStudioArtifactId(`${source}\n`, filename)).not.toBe(first);
		expect(createStudioArtifactId(source, `${filename}.other`)).not.toBe(first);
	});

	test('leaves source without Semantic IR unchanged', () => {
		const invalid = '<script>let broken = ;</script><div>Uncompiled</div>';
		const result = instrumentStudioSource(invalid, '/workspace/src/research/invalid.r4.svelte');
		expect(result.code).toBe(invalid);
		expect(result.nodeIds).toEqual([]);
	});
});

function flattenIds(nodes: NonNullable<ReturnType<typeof compileR4>['ir']>['root']): string[] {
	return nodes.flatMap((node) => {
		if (node.kind === 'element' || node.kind === 'component') return [node.id, ...flattenIds(node.children)];
		if (node.kind === 'if') return flattenIds([...node.consequent, ...node.alternate]);
		if (node.kind === 'each') return flattenIds([...node.children, ...node.fallback]);
		return [];
	});
}
