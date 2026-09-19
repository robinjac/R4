<script lang="ts">
	import type { Snippet } from 'svelte';

	type TextRole = 'body' | 'caption' | 'label' | 'heading' | 'title' | 'code';

	interface Props {
		children?: Snippet;
		role?: TextRole;
		level?: 1 | 2 | 3 | 4 | 5 | 6;
		tone?: 'default' | 'muted' | 'accent' | 'danger' | 'success';
		align?: 'start' | 'center' | 'end';
	}

	let { children, role = 'body', level, tone = 'default', align = 'start' }: Props = $props();

	let tag = $derived(
		level ? (`h${level}` as const) : role === 'title' ? 'h1' : role === 'heading' ? 'h2' : role === 'code' ? 'code' : role === 'body' ? 'p' : 'span'
	);
</script>

<svelte:element
	this={tag}
	data-r4-primitive="Text"
	data-role={role}
	data-tone={tone}
	style:text-align={align}
>
	{@render children?.()}
</svelte:element>

<style>
	:global([data-r4-primitive='Text']) {
		margin: 0;
		color: var(--r4-text, var(--r4-color-text));
		font: var(--r4-type-body);
	}

	:global([data-r4-primitive='Text'][data-role='title']) {
		font: var(--r4-type-title);
		letter-spacing: -0.045em;
	}

	:global([data-r4-primitive='Text'][data-role='heading']) {
		font: var(--r4-type-heading);
		letter-spacing: -0.025em;
	}

	:global([data-r4-primitive='Text'][data-role='caption']) {
		font: var(--r4-type-caption);
	}

	:global([data-r4-primitive='Text'][data-role='label']) {
		font: var(--r4-type-label);
	}

	:global([data-r4-primitive='Text'][data-role='code']) {
		font: var(--r4-type-code);
	}

	:global([data-r4-primitive='Text'][data-tone='muted']) {
		--r4-text: var(--r4-color-text-muted);
	}

	:global([data-r4-primitive='Text'][data-tone='accent']) {
		--r4-text: var(--r4-color-accent);
	}

	:global([data-r4-primitive='Text'][data-tone='danger']) {
		--r4-text: var(--r4-color-danger);
	}

	:global([data-r4-primitive='Text'][data-tone='success']) {
		--r4-text: var(--r4-color-success);
	}
</style>
