<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		label: string;
		live?: 'off' | 'polite';
	}

	let { children, label, live = 'polite' }: Props = $props();
</script>

<ol data-r4-primitive="Feed" role="log" aria-label={label} aria-live={live} aria-relevant="additions text">
	{@render children?.()}
</ol>

<style>
	ol {
		display: grid;
		gap: var(--r4-space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
