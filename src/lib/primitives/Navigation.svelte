<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		children?: Snippet;
		label?: string;
		placement?: 'inline' | 'bottom';
	}

	let { children, label = 'Primary', placement = 'inline' }: Props = $props();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
</script>

<nav {...studioRuntimeAttributes} data-r4-primitive="Navigation" data-placement={placement} aria-label={label}>
	<div class="items">{@render children?.()}</div>
</nav>

<style>
	nav {
		border: 1px solid var(--r4-color-border);
		background: color-mix(in srgb, var(--r4-color-surface-raised) 94%, transparent);
	}

	nav[data-placement='bottom'] {
		position: sticky;
		z-index: 5;
		bottom: 0;
		border-width: 1px 0 0;
		padding-bottom: env(safe-area-inset-bottom);
		backdrop-filter: blur(16px);
	}

	.items {
		display: flex;
		align-items: stretch;
		justify-content: space-around;
		gap: var(--r4-space-2xs);
	}
</style>
