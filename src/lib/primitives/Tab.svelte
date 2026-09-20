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

	function handleKeydown(event: KeyboardEvent & { currentTarget: HTMLButtonElement }) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		const tabs = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [])];
		if (tabs.length === 0) return;
		event.preventDefault();
		const current = tabs.indexOf(event.currentTarget);
		const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
		tabs[next].focus();
		tabs[next].click();
	}
</script>

<button
	type="button"
	data-r4-primitive="Tab"
	role="tab"
	aria-label={label}
	aria-selected={selected}
	tabindex={selected ? 0 : -1}
	{disabled}
	onclick={onselect}
	onkeydown={handleKeydown}
>
	{@render children?.()}
</button>

<style>
	button {
		min-height: 44px;
		flex: 0 0 auto;
		border: 0;
		border-bottom: 3px solid transparent;
		background: transparent;
		color: var(--r4-color-text-muted);
		padding: var(--r4-space-xs) var(--r4-space-sm);
		font: var(--r4-type-label);
		cursor: pointer;
	}

	button[aria-selected='true'] {
		border-bottom-color: var(--r4-color-accent);
		color: var(--r4-color-text);
	}

	button:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 28%, transparent);
		outline-offset: -3px;
	}
</style>
