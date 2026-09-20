<script module lang="ts">
	export const experiment = { id: 'primitive-list-item', title: 'ListItem', group: 'Primitives', kind: 'primitive', description: 'Static or selectable collection item with selected and disabled states.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { List, ListItem, Page, Text } from '$lib/index.js';
	let selected = $state('alpha');
</script>

<Page title="ListItem primitive" description="Focused ListItem primitive specimen">
	<List label="Selectable items">
		<ListItem selected={selected === 'alpha'} onselect={() => (selected = 'alpha')}><Text>Alpha</Text></ListItem>
		<ListItem selected={selected === 'beta'} onselect={() => (selected = 'beta')}><Text>Beta</Text></ListItem>
		<ListItem disabled onselect={() => (selected = 'disabled')}><Text tone="muted">Disabled</Text></ListItem>
	</List>
</Page>
