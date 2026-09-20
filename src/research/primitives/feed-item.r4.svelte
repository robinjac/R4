<script module lang="ts">
	export const experiment = { id: 'primitive-feed-item', title: 'FeedItem', group: 'Primitives', kind: 'primitive', description: 'Feed entry with author, alignment, and delivery status.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Feed, FeedItem, Page, Text } from '$lib/index.js';
</script>

<Page title="FeedItem primitive" description="Focused FeedItem primitive specimen">
	<Feed label="Delivery states" live="off">
		<FeedItem author="System" status="complete"><Text>Completed entry</Text></FeedItem>
		<FeedItem author="You" align="end" status="pending"><Text>Pending entry</Text></FeedItem>
		<FeedItem author="System" status="error"><Text>Failed entry</Text></FeedItem>
	</Feed>
</Page>
