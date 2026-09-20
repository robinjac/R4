import { createHash } from 'node:crypto';
import MagicString, { type SourceMap } from 'magic-string';
import { parse } from 'svelte/compiler';
import type { R4Node } from '../src/lib/compiler/index.js';
import { compileR4 } from '../src/lib/compiler/index.js';
import { R4_STUDIO_PROJECT_COMPILER_PROFILE } from '../src/studio/compiler-profile.js';

const runtimeImport = '/src/studio/StudioRuntimeNode.svelte';

export interface R4StudioInstrumentationResult {
	code: string;
	map: SourceMap;
	artifactId: string;
	nodeIds: string[];
}

export function instrumentStudioSource(source: string, filename: string): R4StudioInstrumentationResult {
	const artifactId = createStudioArtifactId(source, filename);
	const compilation = compileR4(source, { filename, primitiveModules: R4_STUDIO_PROJECT_COMPILER_PROFILE.primitiveModules });
	const code = new MagicString(source);
	if (!compilation.ir) {
		return {
			code: source,
			map: code.generateMap({ hires: true, includeContent: true, source: filename }),
			artifactId,
			nodeIds: []
		};
	}
	const nodes = flatten(compilation.ir.root).filter((node) => node.kind === 'element' || node.kind === 'component');
	if (nodes.length === 0) {
		return {
			code: source,
			map: code.generateMap({ hires: true, includeContent: true, source: filename }),
			artifactId,
			nodeIds: []
		};
	}

	const componentName = uniqueComponentName(source);
	const ast = parse(source, { modern: true });
	for (const node of nodes) {
		code.appendLeft(
			node.range.start.offset,
			`<${componentName} artifactId=${JSON.stringify(artifactId)} nodeId=${JSON.stringify(node.id)}>`
		);
		code.appendRight(node.range.end.offset, `</${componentName}>`);
	}

	const instance = (ast as unknown as { instance?: { content?: { start?: number } } }).instance;
	if (typeof instance?.content?.start === 'number') {
		code.appendLeft(instance.content.start, `\n\timport ${componentName} from ${JSON.stringify(runtimeImport)};`);
	} else {
		code.prepend(`<script>import ${componentName} from ${JSON.stringify(runtimeImport)};</script>\n`);
	}
	return {
		code: code.toString(),
		map: code.generateMap({ hires: true, includeContent: true, source: filename }),
		artifactId,
		nodeIds: nodes.map((node) => node.id)
	};
}

export function createStudioArtifactId(source: string, filename: string): string {
	return createHash('sha256').update(filename).update('\0').update(source).digest('hex');
}

function flatten(nodes: R4Node[]): R4Node[] {
	return nodes.flatMap((node) => {
		if (node.kind === 'element' || node.kind === 'component') return [node, ...flatten(node.children)];
		if (node.kind === 'if') return [node, ...flatten(node.consequent), ...flatten(node.alternate)];
		if (node.kind === 'each') return [node, ...flatten(node.children), ...flatten(node.fallback)];
		return [node];
	});
}

function uniqueComponentName(source: string): string {
	let suffix = '';
	while (source.includes(`R4StudioRuntimeNode${suffix}`)) suffix = suffix ? `${suffix}_` : '_';
	return `R4StudioRuntimeNode${suffix}`;
}
