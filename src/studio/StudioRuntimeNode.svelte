<script lang="ts">
	import { setContext, type Snippet } from 'svelte';
	import { R4_STUDIO_RUNTIME_CONTEXT, type R4StudioRuntimeIdentity } from '../lib/primitives/studio-runtime.js';

	let { artifactId, nodeId, children }: { artifactId: string; nodeId: string; children?: Snippet } = $props();
	const instanceId = $props.id();
	setContext<R4StudioRuntimeIdentity>(R4_STUDIO_RUNTIME_CONTEXT, {
		get artifactId() {
			return artifactId;
		},
		get nodeId() {
			return nodeId;
		},
		instanceId
	});
</script>

{@render children?.()}
