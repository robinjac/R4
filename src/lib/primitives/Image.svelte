<script lang="ts">
	import type { Size } from '../types.js';
	import { size, styleString } from './styles.js';

	interface Props {
		src: string;
		alt: string;
		width?: Size;
		height?: Size;
		fit?: 'cover' | 'contain' | 'fill';
		loading?: 'eager' | 'lazy';
	}

	let { src, alt, width, height, fit = 'cover', loading = 'lazy' }: Props = $props();
	let styles = $derived(styleString({ width: size(width), height: size(height), 'object-fit': fit }));
</script>

<img data-r4-primitive="Image" {src} {alt} {loading} style={styles} />

<style>
	img {
		display: block;
		max-width: 100%;
	}
</style>
