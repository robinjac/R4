<script module lang="ts">
	export const experiment = {
		id: 'interactive-view-diagnostic',
		title: 'Interactive View',
		group: 'Accessibility',
		description: 'A deliberately ambiguous interaction used to exercise cross-platform compiler diagnostics.',
		status: 'modify'
	} as const;
</script>

<script lang="ts">
	import { Page, Stack, Text, View } from '$lib/index.js';

	let open = $state(false);
</script>

<Page title="Interaction diagnostic" padding="lg">
	<Stack gap="lg">
		<Stack gap="xs">
			<Text role="caption" tone="danger">DIAGNOSTIC SPECIMEN</Text>
			<Text role="title">Can intent be inferred?</Text>
			<Text tone="muted">This works with a pointer, but its keyboard and assistive semantics are unclear.</Text>
		</Stack>

		<View
			padding="lg"
			rounded="md"
			bordered
			background={open ? '#dcfce7' : '#fffef9'}
			onclick={() => (open = !open)}
		>
			<Stack direction="horizontal" align="center" distribute="between">
				<Text role="label">{open ? 'Open' : 'Closed'}</Text>
				<Text role="caption" tone="muted">Click this View</Text>
			</Stack>
		</View>
	</Stack>
</Page>
