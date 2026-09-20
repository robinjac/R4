<script module lang="ts">
	export const experiment = { id: 'primitive-layer', title: 'Layer', group: 'Primitives', kind: 'primitive', description: 'Overlapping layout with a shared alignment policy.', status: 'explore' } as const;
</script>

<script lang="ts">
	import { Badge, Layer, Page, Text, View } from '$lib/index.js';
</script>

<Page title="Layer primitive" description="Focused Layer primitive specimen">
	<Layer align="center">
		<View height={180} background="#dbe8df" rounded="lg" bordered></View>
		<Badge tone="accent"><Text role="label">Centered layer</Text></Badge>
	</Layer>
</Page>
