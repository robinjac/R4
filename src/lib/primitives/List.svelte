<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		children?: Snippet;
		label?: string;
		dividers?: boolean;
	}

	let { children, label, dividers = true }: Props = $props();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
</script>

<ul {...studioRuntimeAttributes} data-r4-primitive="List" class:dividers aria-label={label}>
	{@render children?.()}
</ul>

<style>
	ul {
		margin: 0;
		border: 1px solid var(--r4-color-border);
		border-radius: var(--r4-radius-md);
		background: var(--r4-color-surface-raised);
		padding: 0;
		list-style: none;
	}

	ul.dividers :global([data-r4-primitive='ListItem'] + [data-r4-primitive='ListItem']) {
		border-top: 1px solid var(--r4-color-border);
	}
</style>
