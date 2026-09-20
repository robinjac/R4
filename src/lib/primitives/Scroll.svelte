<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Axis } from '../types.js';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		children?: Snippet;
		direction?: Axis | 'both';
		label?: string;
	}

	let { children, direction = 'vertical', label }: Props = $props();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
	let overflowX = $derived(direction === 'horizontal' || direction === 'both' ? 'auto' : 'hidden');
	let overflowY = $derived(direction === 'vertical' || direction === 'both' ? 'auto' : 'hidden');
</script>

<div
	{...studioRuntimeAttributes}
	data-r4-primitive="Scroll"
	role={label ? 'region' : undefined}
	aria-label={label}
	style:overflow-x={overflowX}
	style:overflow-y={overflowY}
>
	{@render children?.()}
</div>
