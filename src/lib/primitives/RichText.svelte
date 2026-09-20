<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		label?: string;
	}

	let { children, label }: Props = $props();
</script>

<article data-r4-primitive="RichText" aria-label={label}>
	{@render children?.()}
</article>

<style>
	article { display: grid; gap: var(--r4-space-xs); }
	article :global(p), article :global(h1), article :global(h2), article :global(h3), article :global(ul), article :global(ol) { margin: 0; }
</style>
