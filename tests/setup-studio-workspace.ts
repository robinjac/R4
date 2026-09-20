import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('test-results/studio-workspace');
await rm(root, { recursive: true, force: true });
await mkdir(resolve(root, 'src'), { recursive: true });
await writeFile(
	resolve(root, 'src/App.r4.svelte'),
	`<script lang="ts">\n\timport { Page, Text } from 'r4';\n</script>\n\n<Page title="Service fixture">\n\t<Text>Initial service source</Text>\n</Page>\n`
);
