<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		label?: string;
		selected?: boolean;
		disabled?: boolean;
		onselect?: () => void;
	}

	let { children, label, selected = false, disabled = false, onselect }: Props = $props();
</script>

<button
	type="button"
	data-r4-primitive="NavigationItem"
	class:selected
	aria-label={label}
	aria-current={selected ? 'page' : undefined}
	aria-pressed={selected}
	{disabled}
	onclick={onselect}
>
	{@render children?.()}
</button>

<style>
	button {
		display: grid;
		min-width: 64px;
		min-height: 52px;
		flex: 1;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--r4-color-text-muted);
		padding: var(--r4-space-xs) var(--r4-space-sm);
		font: var(--r4-type-caption);
		cursor: pointer;
	}

	button.selected {
		color: var(--r4-color-accent);
		box-shadow: inset 0 3px currentColor;
	}

	button:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 28%, transparent);
		outline-offset: -3px;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
</style>
