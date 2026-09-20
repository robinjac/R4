<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Alignment, Axis, Distribution, Space } from '../types.js';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';
	import { space, styleString } from './styles.js';

	interface Props {
		children?: Snippet;
		direction?: Axis;
		gap?: Space;
		align?: Alignment;
		distribute?: Distribution;
		wrap?: boolean;
	}

	let {
		children,
		direction = 'vertical',
		gap = 'none',
		align = 'stretch',
		distribute = 'start',
		wrap = false
	}: Props = $props();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();

	const distribution = {
		start: 'flex-start',
		center: 'center',
		end: 'flex-end',
		between: 'space-between',
		around: 'space-around',
		evenly: 'space-evenly'
	} as const;

	const alignment = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' } as const;

	let styles = $derived(
		styleString({
			display: 'flex',
			'flex-direction': direction === 'vertical' ? 'column' : 'row',
			gap: space(gap),
			'align-items': alignment[align],
			'justify-content': distribution[distribute],
			'flex-wrap': wrap ? 'wrap' : 'nowrap'
		})
	);
</script>

<div {...studioRuntimeAttributes} data-r4-primitive="Stack" data-direction={direction} style={styles}>
	{@render children?.()}
</div>
