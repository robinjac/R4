<script module lang="ts">
	export const experiment = { id: 'primitive-image', title: 'Image', group: 'Primitives', kind: 'primitive', description: 'Accessible image content with sizing, fit, and loading policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Image, Page, Stack, Text } from '$lib/index.js';
</script>

<Page title="Image primitive" description="Focused Image primitive specimen">
	<Stack gap="md" align="center">
		<Image src="/favicon.svg" alt="R4 mark" width={120} height={120} fit="contain" loading="eager" />
		<Text role="caption" tone="muted">Contained image with explicit alternative text.</Text>
	</Stack>
</Page>
