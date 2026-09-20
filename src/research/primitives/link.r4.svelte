<script module lang="ts">
	export const experiment = { id: 'primitive-link', title: 'Link', group: 'Primitives', kind: 'primitive', description: 'Navigation intent with internal and external destination policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Link, Page, Stack, Text } from '$lib/index.js';
</script>

<Page title="Link primitive" description="Focused Link primitive specimen">
	<Stack gap="md" align="start">
		<Link href="/?primitive=View"><Text role="label">Open the View primitive</Text></Link>
		<Link href="https://example.com/docs" external><Text role="label">External documentation</Text></Link>
	</Stack>
</Page>
