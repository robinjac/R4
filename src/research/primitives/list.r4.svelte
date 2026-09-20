<script module lang="ts">
	export const experiment = { id: 'primitive-list', title: 'List', group: 'Primitives', kind: 'primitive', description: 'Ordered collection container with labeling and divider policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { List, ListItem, Page, Text } from '$lib/index.js';
</script>

<Page title="List primitive" description="Focused List primitive specimen">
	<List label="Example collection">
		<ListItem><Text>First collection item</Text></ListItem>
		<ListItem><Text>Second collection item</Text></ListItem>
		<ListItem><Text>Third collection item</Text></ListItem>
	</List>
</Page>
