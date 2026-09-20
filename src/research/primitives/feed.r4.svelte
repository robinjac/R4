<script module lang="ts">
	export const experiment = { id: 'primitive-feed', title: 'Feed', group: 'Primitives', kind: 'primitive', description: 'Chronological live collection with explicit announcement policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Feed, FeedItem, Page, Text } from '$lib/index.js';
</script>

<Page title="Feed primitive" description="Focused Feed primitive specimen">
	<Feed label="Conversation activity" live="polite">
		<FeedItem author="Ada"><Text>Can you review the latest change?</Text></FeedItem>
		<FeedItem author="You" align="end"><Text>Review complete.</Text></FeedItem>
	</Feed>
</Page>
