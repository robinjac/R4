<script module lang="ts">
	export const experiment = { id: 'primitive-navigation-item', title: 'NavigationItem', group: 'Primitives', kind: 'primitive', description: 'Selectable destination intent with current and disabled states.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Navigation, NavigationItem, Page, Text } from '$lib/index.js';
	let destination = $state('home');
</script>

<Page title="NavigationItem primitive" description="Focused NavigationItem primitive specimen">
	<Navigation label="Example destinations">
		<NavigationItem selected={destination === 'home'} onselect={() => (destination = 'home')}><Text role="label">Home</Text></NavigationItem>
		<NavigationItem selected={destination === 'settings'} onselect={() => (destination = 'settings')}><Text role="label">Settings</Text></NavigationItem>
		<NavigationItem disabled><Text role="label">Unavailable</Text></NavigationItem>
	</Navigation>
</Page>
