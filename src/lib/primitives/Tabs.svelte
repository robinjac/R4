<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		children?: Snippet;
		label: string;
	}

	let { children, label }: Props = $props();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
</script>

<div {...studioRuntimeAttributes} data-r4-primitive="Tabs" role="tablist" aria-label={label}>
	{@render children?.()}
</div>

<style>
	div {
		display: flex;
		overflow-x: auto;
		border-bottom: 1px solid var(--r4-color-border);
	}
</style>
