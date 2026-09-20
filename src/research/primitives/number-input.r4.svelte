<script module lang="ts">
	export const experiment = { id: 'primitive-number-input', title: 'NumberInput', group: 'Primitives', kind: 'primitive', description: 'Numeric entry with bounds, increments, units, and nullable values.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { NumberInput, Page, Stack, Text } from '$lib/index.js';
	let quantity = $state<number | null>(4);
</script>

<Page title="NumberInput primitive" description="Focused NumberInput primitive specimen">
	<Stack gap="sm">
		<NumberInput label="Quantity" value={quantity} min={0} max={20} step={1} unit="items" onchange={(value) => (quantity = value)} />
		<Text role="caption" tone="muted">Current value: {quantity ?? 'empty'}</Text>
	</Stack>
</Page>
