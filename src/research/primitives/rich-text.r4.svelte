<script module lang="ts">
	export const experiment = { id: 'primitive-rich-text', title: 'RichText', group: 'Primitives', kind: 'primitive', description: 'Structured article content composed from semantic child primitives.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, RichText, Stack, Text } from '$lib/index.js';
</script>

<Page title="RichText primitive" description="Focused RichText primitive specimen">
	<RichText label="Release notes">
		<Stack gap="sm">
			<Text role="heading">Version 1.0</Text>
			<Text>The first stable semantic UI release is available.</Text>
			<Text role="caption" tone="muted">Published September 2026</Text>
		</Stack>
	</RichText>
</Page>
