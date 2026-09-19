<script module lang="ts">
	export const experiment = {
		id: 'counter-reactivity',
		title: 'Targeted reactivity',
		group: 'Compiler',
		description: 'State, derived state, text dependencies, and an action mutation in one portable component.',
		status: 'keep'
	} as const;
</script>

<script lang="ts">
	import { Button, Page, Stack, Text, View } from '$lib/index.js';

	let count = $state(0);
	let doubled = $derived(count * 2);
</script>

<Page title="R4 counter" description="A compiler-informed R4 reactivity experiment" padding="lg">
	<Stack gap="lg">
		<Stack gap="xs">
			<Text role="caption" tone="accent">COMPILER SLICE 01</Text>
			<Text role="title">State without a virtual tree.</Text>
			<Text tone="muted">The same Svelte source renders here and projects into target-specific update work.</Text>
		</Stack>

		<View padding="lg" rounded="lg" bordered background="#fffef9">
			<Stack gap="md">
				<Stack direction="horizontal" gap="md" align="center" distribute="between">
					<Stack gap="2xs">
						<Text role="caption" tone="muted">COUNT</Text>
						<Text role="heading">{count}</Text>
					</Stack>
					<Stack gap="2xs" align="end">
						<Text role="caption" tone="muted">DERIVED</Text>
						<Text role="heading">{doubled}</Text>
					</Stack>
				</Stack>

				<Button onclick={() => count++}>
					<Text role="label">Increment count</Text>
				</Button>
			</Stack>
		</View>
	</Stack>
</Page>
