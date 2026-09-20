<script module lang="ts">
	export const experiment = { id: 'primitive-alert', title: 'Alert', group: 'Primitives', kind: 'primitive', description: 'Status or urgent notice with tone-specific announcement semantics.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Alert, Page, Stack, Text } from '$lib/index.js';
</script>

<Page title="Alert primitive" description="Focused Alert primitive specimen">
	<Stack gap="sm">
		<Alert title="Information"><Text>Informational status uses a polite status role.</Text></Alert>
		<Alert title="Saved" tone="success"><Text>The change completed successfully.</Text></Alert>
		<Alert title="Action required" tone="danger"><Text>Urgent content uses an alert role.</Text></Alert>
	</Stack>
</Page>
