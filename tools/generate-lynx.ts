import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { lowerToLynx } from '../src/lib/backends/lynx.js';
import { compileR4 } from '../src/lib/compiler/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(root, 'src/research/getting-started/counter.r4.svelte');
const output = resolve(root, 'native/lynx/src/generated.tsx');
const source = await readFile(input, 'utf8');
const compilation = compileR4(source, { filename: input });

if (!compilation.ir) {
	throw new Error(`R4 compilation failed:\n${compilation.diagnostics.map((diagnostic) => diagnostic.message).join('\n')}`);
}

const errors = compilation.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
if (errors.length > 0) {
	throw new Error(`R4 compilation produced errors:\n${errors.map((diagnostic) => diagnostic.message).join('\n')}`);
}

const artifact = lowerToLynx(compilation.ir);
const backendErrors = artifact.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
if (backendErrors.length > 0) {
	throw new Error(`Lynx lowering produced errors:\n${backendErrors.map((diagnostic) => diagnostic.message).join('\n')}`);
}

await writeFile(output, artifact.files[artifact.entry]);
console.log(`Generated ${artifact.entry} from ${compilation.ir.source.filename}`);
