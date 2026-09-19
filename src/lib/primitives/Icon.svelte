<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		name: string;
		label?: string;
		children?: Snippet;
		size?: 'sm' | 'md' | 'lg';
	}

	let { name, label, children, size = 'md' }: Props = $props();
</script>

<span
	data-r4-primitive="Icon"
	data-icon={name}
	data-size={size}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	{#if children}
		{@render children()}
	{:else}
		{name}
	{/if}
</span>

<style>
	span {
		display: inline-grid;
		width: 1em;
		height: 1em;
		place-items: center;
		font-family: var(--r4-font-mono);
		font-size: 1rem;
		line-height: 1;
	}

	span[data-size='sm'] {
		font-size: 0.8rem;
	}

	span[data-size='lg'] {
		font-size: 1.25rem;
	}
</style>
