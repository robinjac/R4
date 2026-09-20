<script module lang="ts">
	export const experiment = { id: 'primitive-progress', title: 'Progress', group: 'Primitives', kind: 'primitive', description: 'Determinate or indeterminate progress with accessible labeling.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Progress, Stack } from '$lib/index.js';
</script>

<Page title="Progress primitive" description="Focused Progress primitive specimen">
	<Stack gap="lg">
		<Progress label="Upload progress" value={64} />
		<Progress label="Preparing output" />
	</Stack>
</Page>
