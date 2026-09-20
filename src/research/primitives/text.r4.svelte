<script module lang="ts">
	export const experiment = { id: 'primitive-text', title: 'Text', group: 'Primitives', kind: 'primitive', description: 'Semantic text roles, hierarchy, tone, and alignment.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Stack, Text } from '$lib/index.js';
</script>

<Page title="Text primitive" description="Focused Text primitive specimen">
	<Stack gap="sm">
		<Text role="title">Title role</Text>
		<Text role="heading" tone="accent">Heading role</Text>
		<Text>Body copy carries the primary reading content.</Text>
		<Text role="caption" tone="muted">Caption role with muted tone</Text>
		<Text role="code">const semantic = true;</Text>
	</Stack>
</Page>
