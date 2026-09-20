<script module lang="ts">
	export const experiment = { id: 'primitive-tab', title: 'Tab', group: 'Primitives', kind: 'primitive', description: 'Individual tab selection intent with keyboard and disabled states.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Tab, Tabs, Text } from '$lib/index.js';
	let active = $state('first');
</script>

<Page title="Tab primitive" description="Focused Tab primitive specimen">
	<Tabs label="Tab states">
		<Tab selected={active === 'first'} onselect={() => (active = 'first')}><Text role="label">Selected</Text></Tab>
		<Tab selected={active === 'second'} onselect={() => (active = 'second')}><Text role="label">Available</Text></Tab>
		<Tab disabled><Text role="label">Disabled</Text></Tab>
	</Tabs>
</Page>
