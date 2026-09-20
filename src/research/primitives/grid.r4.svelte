<script module lang="ts">
	export const experiment = { id: 'primitive-grid', title: 'Grid', group: 'Primitives', kind: 'primitive', description: 'Two-dimensional layout with fixed or adaptive columns.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Grid, Page, Text, View } from '$lib/index.js';
</script>

<Page title="Grid primitive" description="Focused Grid primitive specimen">
	<Grid columns={2} gap="sm">
		<View padding="md" background="#eef4ff" rounded="sm"><Text>Column one</Text></View>
		<View padding="md" background="#e8f7ed" rounded="sm"><Text>Column two</Text></View>
		<View padding="md" background="#fff3dc" rounded="sm"><Text>Column three</Text></View>
		<View padding="md" background="#f3edff" rounded="sm"><Text>Column four</Text></View>
	</Grid>
</Page>
