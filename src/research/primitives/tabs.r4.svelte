<script module lang="ts">
	export const experiment = { id: 'primitive-tabs', title: 'Tabs', group: 'Primitives', kind: 'primitive', description: 'Keyboard-aware tab-set container for switching related views.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Tab, Tabs, Text, View } from '$lib/index.js';
	let active = $state('overview');
</script>

<Page title="Tabs primitive" description="Focused Tabs primitive specimen" padding="none">
	<Tabs label="Example sections">
		<Tab selected={active === 'overview'} onselect={() => (active = 'overview')}><Text role="label">Overview</Text></Tab>
		<Tab selected={active === 'activity'} onselect={() => (active = 'activity')}><Text role="label">Activity</Text></Tab>
	</Tabs>
	<View padding="lg"><Text>Active panel: {active}</Text></View>
</Page>
