<script module lang="ts">
	export const experiment = { id: 'primitive-icon', title: 'Icon', group: 'Primitives', kind: 'primitive', description: 'Named symbol content with explicit accessible-label policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Icon, Page, Stack, Text } from '$lib/index.js';
</script>

<Page title="Icon primitive" description="Focused Icon primitive specimen">
	<Stack direction="horizontal" gap="lg" align="center">
		<Icon name="check" label="Completed" size="lg">OK</Icon>
		<Stack gap="2xs"><Text role="label">Completed</Text><Text role="caption" tone="muted">The symbol exposes an accessible name.</Text></Stack>
	</Stack>
</Page>
