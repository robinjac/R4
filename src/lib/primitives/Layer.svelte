<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Alignment } from '../types.js';

	interface Props {
		children?: Snippet;
		align?: Alignment;
	}

	let { children, align = 'stretch' }: Props = $props();
</script>

<div data-r4-primitive="Layer" class="layer" data-align={align}>
	{@render children?.()}
</div>

<style>
	.layer {
		display: grid;
	}

	.layer > :global(*) {
		grid-area: 1 / 1;
	}

	.layer[data-align='start'] {
		place-items: start;
	}

	.layer[data-align='center'] {
		place-items: center;
	}

	.layer[data-align='end'] {
		place-items: end;
	}

	.layer[data-align='stretch'] {
		place-items: stretch;
	}
</style>
