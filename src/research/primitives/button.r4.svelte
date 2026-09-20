<script module lang="ts">
	export const experiment = { id: 'primitive-button', title: 'Button', group: 'Primitives', kind: 'primitive', description: 'Explicit activation intent with variants and disabled policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Button, Page, Stack, Text } from '$lib/index.js';
	let clicks = $state(0);
</script>

<Page title="Button primitive" description="Focused Button primitive specimen">
	<Stack gap="md" align="start">
		<Button onclick={() => clicks++}><Text role="label">Activate</Text></Button>
		<Button variant="secondary"><Text role="label">Secondary action</Text></Button>
		<Button variant="danger"><Text role="label">Danger action</Text></Button>
		<Text role="caption" tone="muted">Activation count: {clicks}</Text>
	</Stack>
</Page>
