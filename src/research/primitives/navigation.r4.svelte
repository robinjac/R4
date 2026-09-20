<script module lang="ts">
	export const experiment = { id: 'primitive-navigation', title: 'Navigation', group: 'Primitives', kind: 'primitive', description: 'Primary navigation container with inline and bottom placement policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Navigation, NavigationItem, Page, Text } from '$lib/index.js';
</script>

<Page title="Navigation primitive" description="Focused Navigation primitive specimen" padding="none">
	<Navigation label="Primary destinations">
		<NavigationItem selected><Text role="label">Overview</Text></NavigationItem>
		<NavigationItem><Text role="label">Activity</Text></NavigationItem>
		<NavigationItem><Text role="label">Settings</Text></NavigationItem>
	</Navigation>
</Page>
