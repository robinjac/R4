<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Insets, Radius, Size, Surface } from '../types.js';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';
	import { insets, radius, size, styleString, surface } from './styles.js';

	interface Props {
		children?: Snippet;
		width?: Size;
		height?: Size;
		padding?: Insets;
		background?: Surface;
		rounded?: Radius | boolean;
		bordered?: boolean;
		label?: string;
		onclick?: (event: MouseEvent) => void;
		onkeydown?: (event: KeyboardEvent) => void;
	}

	let {
		children,
		width,
		height,
		padding,
		background,
		rounded,
		bordered = false,
		label,
		onclick,
		onkeydown
	}: Props = $props();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();

	let styles = $derived(
		styleString({
			width: size(width),
			height: size(height),
			padding: insets(padding),
			background: surface(background),
			'border-radius': radius(rounded),
			border: bordered ? '1px solid var(--r4-color-border)' : undefined
		})
	);
</script>

<!-- R4's compiler reports cross-platform interaction semantics for a clickable View. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	{...studioRuntimeAttributes}
	data-r4-primitive="View"
	aria-label={label}
	style={styles}
	{onclick}
	{onkeydown}
>
	{@render children?.()}
</div>
