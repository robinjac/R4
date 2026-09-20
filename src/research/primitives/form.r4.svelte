<script module lang="ts">
	export const experiment = { id: 'primitive-form', title: 'Form', group: 'Primitives', kind: 'primitive', description: 'Form coordination and submit intent without DOM event leakage.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Button, Form, Input, Page, Stack, Text } from '$lib/index.js';
	let value = $state('');
	let submitted = $state(false);
</script>

<Page title="Form primitive" description="Focused Form primitive specimen">
	<Stack gap="md">
		<Form label="Example form" onsubmit={() => (submitted = true)}>
			<Input label="Value" value={value} onchange={(next) => (value = next)} />
			<Button type="submit"><Text role="label">Submit form</Text></Button>
		</Form>
		<Text role="caption" tone="muted">{submitted ? 'Submitted' : 'Waiting for submission'}</Text>
	</Stack>
</Page>
