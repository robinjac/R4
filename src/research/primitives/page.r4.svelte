<script module lang="ts">
	export const experiment = { id: 'primitive-page', title: 'Page', group: 'Primitives', kind: 'primitive', description: 'Top-level page boundary with metadata, surface, and spacing policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Stack, Text } from '$lib/index.js';
</script>

<Page title="Page primitive" description="Focused Page primitive specimen" background="#f5f7f4" padding="xl">
	<Stack gap="sm">
		<Text role="title">Page boundary</Text>
		<Text>In the Workbench this becomes an embedded section and leaves document metadata untouched.</Text>
	</Stack>
</Page>
