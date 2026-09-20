<script module lang="ts">
	export const experiment = { id: 'primitive-switch', title: 'Switch', group: 'Primitives', kind: 'primitive', description: 'Boolean setting control with normalized checked-state callbacks.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Stack, Switch, Text } from '$lib/index.js';
	let enabled = $state(true);
</script>

<Page title="Switch primitive" description="Focused Switch primitive specimen">
	<Stack gap="sm">
		<Switch label="Notifications" description="Receive activity updates." checked={enabled} onchange={(value) => (enabled = value)} />
		<Text role="caption" tone="muted">Notifications are {enabled ? 'enabled' : 'disabled'}.</Text>
	</Stack>
</Page>
