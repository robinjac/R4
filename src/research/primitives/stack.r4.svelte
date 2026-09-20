<script module lang="ts">
	export const experiment = { id: 'primitive-stack', title: 'Stack', group: 'Primitives', kind: 'primitive', description: 'Ordered linear layout across horizontal and vertical axes.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Badge, Page, Stack, Text } from '$lib/index.js';
</script>

<Page title="Stack primitive" description="Focused Stack primitive specimen">
	<Stack gap="md">
		<Text role="heading">Vertical stack</Text>
		<Stack direction="horizontal" gap="sm" align="center">
			<Badge tone="accent">First</Badge>
			<Badge tone="success">Second</Badge>
			<Badge>Third</Badge>
		</Stack>
	</Stack>
</Page>
