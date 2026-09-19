<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
		variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
		type?: 'button' | 'submit' | 'reset';
		label?: string;
	}

	let {
		children,
		onclick,
		disabled = false,
		variant = 'primary',
		type = 'button',
		label
	}: Props = $props();
</script>

<button
	data-r4-primitive="Button"
	data-variant={variant}
	{type}
	{disabled}
	{onclick}
	aria-label={label}
>
	{@render children?.()}
</button>

<style>
	button {
		min-height: 44px;
		border: 1px solid transparent;
		border-radius: var(--r4-radius-md);
		padding: var(--r4-space-sm) var(--r4-space-md);
		font: var(--r4-type-label);
		cursor: pointer;
		transition:
			transform 120ms ease,
			background 120ms ease,
			border-color 120ms ease;
	}

	button[data-variant='primary'] {
		background: var(--r4-color-action);
		color: var(--r4-color-on-action);
	}

	button[data-variant='secondary'] {
		border-color: var(--r4-color-border-strong);
		background: var(--r4-color-surface-raised);
		color: var(--r4-color-text);
	}

	button[data-variant='quiet'] {
		background: transparent;
		color: var(--r4-color-accent);
	}

	button[data-variant='danger'] {
		background: var(--r4-color-danger);
		color: white;
	}

	button:hover:not(:disabled) {
		transform: translateY(-1px);
	}

	button:active:not(:disabled) {
		transform: translateY(0);
	}

	button:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 35%, transparent);
		outline-offset: 2px;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
</style>
