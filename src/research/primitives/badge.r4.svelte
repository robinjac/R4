<script module lang="ts">
	export const experiment = { id: 'primitive-badge', title: 'Badge', group: 'Primitives', kind: 'primitive', description: 'Compact status label with semantic tone policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Badge, Page, Stack, Text } from '$lib/index.js';
</script>

<Page title="Badge primitive" description="Focused Badge primitive specimen">
	<Stack direction="horizontal" gap="sm" align="center" wrap>
		<Badge><Text role="caption">Neutral</Text></Badge>
		<Badge tone="accent"><Text role="caption">Accent</Text></Badge>
		<Badge tone="success"><Text role="caption">Success</Text></Badge>
		<Badge tone="warning"><Text role="caption">Warning</Text></Badge>
		<Badge tone="danger"><Text role="caption">Danger</Text></Badge>
	</Stack>
</Page>
