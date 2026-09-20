<script module lang="ts">
	export const experiment = { id: 'primitive-checkbox', title: 'Checkbox', group: 'Primitives', kind: 'primitive', description: 'Independent boolean choice with normalized checked-state callbacks.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Checkbox, Page, Stack, Text } from '$lib/index.js';
	let accepted = $state(false);
</script>

<Page title="Checkbox primitive" description="Focused Checkbox primitive specimen">
	<Stack gap="sm">
		<Checkbox label="Accept terms" description="This choice can be toggled independently." checked={accepted} onchange={(value) => (accepted = value)} />
		<Text role="caption" tone="muted">{accepted ? 'Accepted' : 'Not accepted'}</Text>
	</Stack>
</Page>
