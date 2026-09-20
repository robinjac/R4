<script module lang="ts">
	export const experiment = { id: 'primitive-date-input', title: 'DateInput', group: 'Primitives', kind: 'primitive', description: 'Calendar-date entry represented as a portable date string.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { DateInput, Page, Stack, Text } from '$lib/index.js';
	let date = $state('2026-09-20');
</script>

<Page title="DateInput primitive" description="Focused DateInput primitive specimen">
	<Stack gap="sm">
		<DateInput label="Date" value={date} min="2026-01-01" max="2026-12-31" onchange={(value) => (date = value)} />
		<Text role="caption" tone="muted">Selected date: {date}</Text>
	</Stack>
</Page>
