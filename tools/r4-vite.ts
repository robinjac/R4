import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { lowerToLynx } from '../src/lib/backends/lynx.js';
import { compileR4 } from '../src/lib/compiler/index.js';

const virtualPrefix = '\0r4-ir:';

export function r4CompilerPlugin(): Plugin {
	return {
		name: 'r4-semantic-compiler',
		enforce: 'pre',
		async resolveId(id, importer) {
			const [filename, query = ''] = id.split('?', 2);
			if (!new URLSearchParams(query).has('r4-ir')) return null;
			const resolved = await this.resolve(filename, importer, { skipSelf: true });
			return `${virtualPrefix}${encodeURIComponent(resolved?.id ?? filename)}.js`;
		},
		async load(id) {
			if (!id.startsWith(virtualPrefix)) return null;
			const filename = decodeURIComponent(id.slice(virtualPrefix.length, -3));

			this.addWatchFile(filename);
			const source = await readFile(filename, 'utf8');
			const compiler = compileR4(source, { filename });
			const hasErrors = compiler.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
			const lynx = compiler.ir && !hasErrors ? lowerToLynx(compiler.ir) : null;
			return `export default ${JSON.stringify({ compiler, backends: { lynx } })};`;
		}
	};
}
