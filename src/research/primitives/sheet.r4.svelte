<script module lang="ts">
	export const experiment = { id: 'primitive-sheet', title: 'Sheet', group: 'Primitives', kind: 'primitive', description: 'Blocking modal sheet with contained overlay, focus, and dismissal policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Button, Page, Sheet, Stack, Text } from '$lib/index.js';
	let open = $state(true);
</script>

<Page title="Sheet primitive" description="Focused Sheet primitive specimen">
	<Button onclick={() => (open = true)}><Text role="label">Open sheet</Text></Button>
	<Sheet title="Primitive details" description="A modal bottom-sheet presentation." {open} onclose={() => (open = false)}>
		<Stack gap="md">
			<Text>The sheet body accepts portable R4 content.</Text>
			<Button variant="secondary" onclick={() => (open = false)}><Text role="label">Finish</Text></Button>
		</Stack>
	</Sheet>
</Page>
