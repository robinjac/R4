<script module lang="ts">
	export const experiment = { id: 'primitive-textarea', title: 'Textarea', group: 'Primitives', kind: 'primitive', description: 'Multiline text entry with normalized value callbacks.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Stack, Text, Textarea } from '$lib/index.js';
	let note = $state('Portable interfaces start with semantic intent.');
</script>

<Page title="Textarea primitive" description="Focused Textarea primitive specimen">
	<Stack gap="sm">
		<Textarea label="Note" rows={4} value={note} onchange={(value) => (note = value)} />
		<Text role="caption" tone="muted">{note.length} characters</Text>
	</Stack>
</Page>
