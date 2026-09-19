<script module lang="ts">
	export const experiment = {
		id: 'adaptive-grid',
		title: 'Adaptive grid',
		group: 'Layout',
		description: 'Parent-owned spacing and an adaptive grid without exposing the complete CSS layout model.',
		status: 'explore'
	} as const;
</script>

<script lang="ts">
	import { Grid, Page, Stack, Text, View } from '$lib/index.js';

	const signals = [
		{ label: 'Compile', value: '18 ms', tone: '#dbeafe' },
		{ label: 'Updates', value: '2 direct', tone: '#dcfce7' },
		{ label: 'Payload', value: '3.8 kb', tone: '#fef3c7' }
	];
</script>

<Page title="Adaptive layout" padding="lg">
	<Stack gap="lg">
		<Stack gap="xs">
			<Text role="caption" tone="accent">LAYOUT LAB</Text>
			<Text role="title">The parent owns the rhythm.</Text>
			<Text tone="muted">Cards have no external margin. Grid and Stack decide how the composition breathes.</Text>
		</Stack>

		<Grid columns="adaptive" minColumnWidth={170} gap="md">
			{#each signals as signal}
				<View padding="md" rounded="md" background={signal.tone}>
					<Stack gap="xs">
						<Text role="caption">{signal.label}</Text>
						<Text role="heading">{signal.value}</Text>
					</Stack>
				</View>
			{/each}
		</Grid>
	</Stack>
</Page>
