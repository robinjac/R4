<script module lang="ts">
	export const experiment = { id: 'primitive-input', title: 'Input', group: 'Primitives', kind: 'primitive', description: 'Single-line text entry with normalized value callbacks.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Input, Page, Stack, Text } from '$lib/index.js';
	let name = $state('Ada');
</script>

<Page title="Input primitive" description="Focused Input primitive specimen">
	<Stack gap="sm">
		<Input label="Name" value={name} description="Enter a display name." onchange={(value) => (name = value)} />
		<Text role="caption" tone="muted">Current value: {name || 'empty'}</Text>
	</Stack>
</Page>
