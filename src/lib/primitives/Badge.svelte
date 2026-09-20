<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
		label?: string;
	}

	let { children, tone = 'neutral', label }: Props = $props();
</script>

<span data-r4-primitive="Badge" data-tone={tone} aria-label={label}>
	{@render children?.()}
</span>

<style>
	span {
		display: inline-flex;
		width: fit-content;
		align-items: center;
		border: 1px solid var(--r4-color-border-strong);
		border-radius: var(--r4-radius-full);
		background: var(--r4-color-surface);
		padding: 3px 8px;
		color: var(--r4-color-text-muted);
		font: var(--r4-type-caption);
	}

	span[data-tone='accent'] {
		border-color: color-mix(in srgb, var(--r4-color-accent) 42%, transparent);
		background: color-mix(in srgb, var(--r4-color-accent) 9%, var(--r4-color-surface-raised));
		color: var(--r4-color-accent);
	}

	span[data-tone='success'] {
		border-color: color-mix(in srgb, var(--r4-color-success) 42%, transparent);
		background: color-mix(in srgb, var(--r4-color-success) 9%, var(--r4-color-surface-raised));
		color: var(--r4-color-success);
	}

	span[data-tone='warning'] {
		border-color: #b27b18;
		background: #fff4d7;
		color: #77500a;
	}

	span[data-tone='danger'] {
		border-color: color-mix(in srgb, var(--r4-color-danger) 42%, transparent);
		background: color-mix(in srgb, var(--r4-color-danger) 8%, var(--r4-color-surface-raised));
		color: var(--r4-color-danger);
	}
</style>
