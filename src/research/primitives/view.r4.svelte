<script module lang="ts">
	export const experiment = { id: 'primitive-view', title: 'View', group: 'Primitives', kind: 'primitive', description: 'Generic container structure with surface, spacing, border, and size policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Text, View } from '$lib/index.js';
</script>

<Page title="View primitive" description="Focused View primitive specimen">
	<View padding="lg" background="#eef4ff" rounded="md" bordered>
		<Text role="heading">Contained surface</Text>
		<Text tone="muted">View supplies generic structure without imposing domain meaning.</Text>
	</View>
</Page>
