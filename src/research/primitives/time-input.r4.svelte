<script module lang="ts">
	export const experiment = { id: 'primitive-time-input', title: 'TimeInput', group: 'Primitives', kind: 'primitive', description: 'Local-time entry represented as a portable time string.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Stack, Text, TimeInput } from '$lib/index.js';
	let time = $state('09:30');
</script>

<Page title="TimeInput primitive" description="Focused TimeInput primitive specimen">
	<Stack gap="sm">
		<TimeInput label="Start time" value={time} step={900} onchange={(value) => (time = value)} />
		<Text role="caption" tone="muted">Selected time: {time}</Text>
	</Stack>
</Page>
