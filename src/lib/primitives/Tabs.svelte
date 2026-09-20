<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		label: string;
	}

	let { children, label }: Props = $props();
</script>

<div data-r4-primitive="Tabs" role="tablist" aria-label={label}>
	{@render children?.()}
</div>

<style>
	div {
		display: flex;
		overflow-x: auto;
		border-bottom: 1px solid var(--r4-color-border);
	}
</style>
