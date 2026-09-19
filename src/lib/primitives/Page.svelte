<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getContext } from 'svelte';
	import type { Insets, Surface } from '../types.js';
	import PageMetadata from './PageMetadata.svelte';
	import { insets, styleString, surface } from './styles.js';

	interface Props {
		title: string;
		description?: string;
		children?: Snippet;
		padding?: Insets;
		background?: Surface;
	}

	let { title, description, children, padding = 'lg', background }: Props = $props();
	let styles = $derived(styleString({ padding: insets(padding), background: surface(background) }));
	const embedded = getContext<boolean>('r4:embedded-page') ?? false;
</script>

{#if !embedded}
	<PageMetadata {title} {description} />
{/if}

<svelte:element this={embedded ? 'section' : 'main'} data-r4-primitive="Page" aria-label={embedded ? title : undefined} style={styles}>
	{@render children?.()}
</svelte:element>

<style>
	[data-r4-primitive='Page'] {
		box-sizing: border-box;
		min-height: 100%;
	}
</style>
