<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		href: string;
		children?: Snippet;
		external?: boolean;
		label?: string;
	}

	let { href, children, external = false, label }: Props = $props();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
</script>

<a
	{...studioRuntimeAttributes}
	data-r4-primitive="Link"
	{href}
	aria-label={label}
	target={external ? '_blank' : undefined}
	rel={external ? 'noreferrer' : undefined}
>
	{@render children?.()}
</a>

<style>
	a {
		color: var(--r4-color-accent);
		text-decoration-thickness: 0.08em;
		text-underline-offset: 0.18em;
	}

	a:focus-visible {
		border-radius: 2px;
		outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 28%, transparent);
		outline-offset: 3px;
	}
</style>
