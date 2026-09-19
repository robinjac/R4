<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Alignment, Space } from '../types.js';
	import { space, styleString } from './styles.js';

	interface Props {
		children?: Snippet;
		columns?: number | 'adaptive';
		minColumnWidth?: number;
		gap?: Space;
		align?: Alignment;
	}

	let {
		children,
		columns = 'adaptive',
		minColumnWidth = 220,
		gap = 'md',
		align = 'stretch'
	}: Props = $props();

	let styles = $derived(
		styleString({
			display: 'grid',
			'grid-template-columns':
				columns === 'adaptive' ? `repeat(auto-fit, minmax(min(${minColumnWidth}px, 100%), 1fr))` : `repeat(${columns}, minmax(0, 1fr))`,
			gap: space(gap),
			'align-items': align
		})
	);
</script>

<div data-r4-primitive="Grid" style={styles}>
	{@render children?.()}
</div>
