<script module lang="ts">
	export const experiment = { id: 'primitive-select', title: 'Select', group: 'Primitives', kind: 'primitive', description: 'Single-value selection from a portable option collection.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Select, Stack, Text } from '$lib/index.js';
	const options = [
		{ value: 'web', label: 'Web' },
		{ value: 'ios', label: 'iOS' },
		{ value: 'android', label: 'Android' }
	];
	let platform = $state('web');
</script>

<Page title="Select primitive" description="Focused Select primitive specimen">
	<Stack gap="sm">
		<Select label="Platform" {options} value={platform} onchange={(value) => (platform = value)} />
		<Text role="caption" tone="muted">Selected value: {platform}</Text>
	</Stack>
</Page>
