<script module lang="ts">
	export const experiment = { id: 'primitive-scroll', title: 'Scroll', group: 'Primitives', kind: 'primitive', description: 'Named scroll region with horizontal, vertical, or bidirectional policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Page, Scroll, Text, View } from '$lib/index.js';
</script>

<Page title="Scroll primitive" description="Focused Scroll primitive specimen">
	<View width={220} padding="sm" bordered rounded="sm">
		<Scroll direction="horizontal" label="Long identifier">
			<Text role="code">R4-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-SEMANTIC-INTERFACE</Text>
		</Scroll>
	</View>
</Page>
