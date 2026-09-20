<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		title?: string;
		tone?: 'info' | 'success' | 'warning' | 'danger';
	}

	let { children, title, tone = 'info' }: Props = $props();
</script>

<aside data-r4-primitive="Alert" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
	{#if title}<strong>{title}</strong>{/if}
	<div>{@render children?.()}</div>
</aside>

<style>
	aside { display: grid; gap: var(--r4-space-2xs); border-left: 4px solid var(--r4-color-accent); border-radius: var(--r4-radius-sm); background: color-mix(in srgb, var(--r4-color-accent) 8%, var(--r4-color-surface-raised)); padding: var(--r4-space-sm); }
	aside[data-tone='success'] { border-color: var(--r4-color-success); background: color-mix(in srgb, var(--r4-color-success) 8%, var(--r4-color-surface-raised)); }
	aside[data-tone='warning'] { border-color: #b27b18; background: #fff4d7; }
	aside[data-tone='danger'] { border-color: var(--r4-color-danger); background: color-mix(in srgb, var(--r4-color-danger) 8%, var(--r4-color-surface-raised)); }
	strong { font: var(--r4-type-label); }
	div { color: var(--r4-color-text-muted); font: var(--r4-type-caption); }
</style>
