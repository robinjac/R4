<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		children?: Snippet;
		label?: string;
		selected?: boolean;
		disabled?: boolean;
		onselect?: () => void;
	}

	let { children, label, selected = false, disabled = false, onselect }: Props = $props();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
</script>

<li {...studioRuntimeAttributes} data-r4-primitive="ListItem" class:selected>
	{#if onselect}
		<button type="button" aria-label={label} aria-pressed={selected} {disabled} onclick={onselect}>
			{@render children?.()}
		</button>
	{:else}
		<div class="content" aria-label={label}>{@render children?.()}</div>
	{/if}
</li>

<style>
	li {
		min-width: 0;
	}

	li.selected {
		background: color-mix(in srgb, var(--r4-color-accent) 8%, var(--r4-color-surface-raised));
		box-shadow: inset 3px 0 var(--r4-color-accent);
	}

	button,
	.content {
		display: block;
		width: 100%;
		min-height: 48px;
		border: 0;
		background: transparent;
		color: inherit;
		padding: var(--r4-space-sm);
		text-align: left;
	}

	button {
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--r4-color-accent) 6%, transparent);
	}

	button:focus-visible {
		position: relative;
		z-index: 1;
		outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 28%, transparent);
		outline-offset: -3px;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
</style>
