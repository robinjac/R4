<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		author?: string;
		align?: 'start' | 'end';
		status?: 'pending' | 'complete' | 'error';
	}

	let { children, author, align = 'start', status = 'complete' }: Props = $props();
</script>

<li data-r4-primitive="FeedItem" data-align={align} data-status={status}>
	{#if author}<span class="author">{author}</span>{/if}
	<div class="content">{@render children?.()}</div>
</li>

<style>
	li {
		display: grid;
		max-width: min(88%, 620px);
		gap: var(--r4-space-2xs);
		justify-self: start;
	}

	li[data-align='end'] {
		justify-self: end;
	}

	.author {
		color: var(--r4-color-text-muted);
		font: var(--r4-type-caption);
	}

	li[data-align='end'] .author {
		text-align: right;
	}

	.content {
		border: 1px solid var(--r4-color-border);
		border-radius: var(--r4-radius-md);
		background: var(--r4-color-surface-raised);
		padding: var(--r4-space-sm);
	}

	li[data-align='end'] .content {
		border-color: color-mix(in srgb, var(--r4-color-accent) 32%, var(--r4-color-border));
		background: color-mix(in srgb, var(--r4-color-accent) 8%, var(--r4-color-surface-raised));
	}

	li[data-status='pending'] {
		opacity: 0.7;
	}

	li[data-status='error'] .content {
		border-color: var(--r4-color-danger);
	}
</style>
