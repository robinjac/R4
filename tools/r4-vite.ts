import { readFile } from 'node:fs/promises';
import { createHighlighter } from 'shiki';
import type { Plugin } from 'vite';
import { lowerToLynx } from '../src/lib/backends/lynx.js';
import { compileR4, type R4Platform } from '../src/lib/compiler/index.js';
import { projectPlatform } from '../src/lib/policy.js';
import type { WorkbenchHighlightedCode, WorkbenchHighlighting } from '../src/workbench/types.js';
import { createStudioArtifactId, instrumentStudioSource } from './studio-instrumentation.js';

const irVirtualPrefix = '\0r4-ir:';
const highlightVirtualPrefix = '\0r4-highlights:';
const studioArtifactVirtualPrefix = '\0r4-studio-artifact:';
const highlighter = createHighlighter({ langs: ['json', 'svelte', 'tsx'], themes: ['github-dark'] });
const platforms: R4Platform[] = ['web', 'ios', 'android', 'macos', 'windows'];

function tokenize(shiki: Awaited<typeof highlighter>, source: string, language: 'json' | 'svelte' | 'tsx'): WorkbenchHighlightedCode {
	const colors: string[] = [];
	const colorIndexes = new Map<string, number>();
	const { tokens } = shiki.codeToTokens(source, { lang: language, theme: 'github-dark' });
	return {
		colors,
		lines: tokens.map((line) =>
			line.map((token) => {
				const color = token.color ?? 'inherit';
				let index = colorIndexes.get(color);
				if (index === undefined) {
					index = colors.length;
					colors.push(color);
					colorIndexes.set(color, index);
				}
				return [token.content, index];
			})
		)
	};
}

export function r4CompilerPlugin(): Plugin {
	return {
		name: 'r4-semantic-compiler',
		enforce: 'pre',
		transform(source, id) {
			const [filename, query = ''] = id.split('?', 2);
			if (!new URLSearchParams(query).has('r4-studio-entry')) return null;
			const instrumented = instrumentStudioSource(source, filename);
			return { code: instrumented.code, map: instrumented.map };
		},
		async resolveId(id, importer) {
			const [filename, query = ''] = id.split('?', 2);
			const parameters = new URLSearchParams(query);
			const prefix = parameters.has('r4-ir')
				? irVirtualPrefix
				: parameters.has('r4-highlights')
					? highlightVirtualPrefix
					: parameters.has('r4-studio-artifact')
						? studioArtifactVirtualPrefix
						: null;
			if (!prefix) return null;
			const resolved = await this.resolve(filename, importer, { skipSelf: true });
			return `${prefix}${encodeURIComponent(resolved?.id ?? filename)}.js`;
		},
		async load(id) {
			const prefix = id.startsWith(irVirtualPrefix)
				? irVirtualPrefix
				: id.startsWith(highlightVirtualPrefix)
					? highlightVirtualPrefix
					: id.startsWith(studioArtifactVirtualPrefix)
						? studioArtifactVirtualPrefix
						: null;
			if (!prefix) return null;
			const filename = decodeURIComponent(id.slice(prefix.length, -3));

			this.addWatchFile(filename);
			const source = await readFile(filename, 'utf8');
			if (prefix === studioArtifactVirtualPrefix) return `export default ${JSON.stringify(createStudioArtifactId(source, filename))};`;
			const compiler = compileR4(source, { filename });
			const hasErrors = compiler.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
			const lynx = compiler.ir && !hasErrors ? lowerToLynx(compiler.ir) : null;
			if (prefix === irVirtualPrefix) return `export default ${JSON.stringify({ compiler, backends: { lynx } })};`;

			const shiki = await highlighter;
			const json = (value: unknown) => tokenize(shiki, JSON.stringify(value, null, 2), 'json');
			const platformEntries = platforms.map((platform) => [platform, compiler.ir ? projectPlatform(compiler.ir, platform) : null] as const);
			const highlighting: WorkbenchHighlighting = {
				source: tokenize(shiki, source, 'svelte'),
				ast: json(compiler.ast),
				semantic: json(compiler.ir),
				platforms: Object.fromEntries(
					platformEntries.map(([platform, projection]) => [platform, json(projection)])
				) as Record<R4Platform, WorkbenchHighlightedCode>,
				lynx: tokenize(shiki, lynx?.files[lynx.entry] ?? '// No Lynx artifact generated.', 'tsx')
			};
			return `export default ${JSON.stringify(highlighting)};`;
		}
	};
}
