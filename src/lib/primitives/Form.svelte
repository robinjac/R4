<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		children?: Snippet;
		label?: string;
		onsubmit?: () => void;
	}

	let { children, label, onsubmit }: Props = $props();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		onsubmit?.();
	}
</script>

<form {...studioRuntimeAttributes} data-r4-primitive="Form" aria-label={label} onsubmit={handleSubmit}>
	{@render children?.()}
</form>

<style>
	form {
		display: grid;
		gap: var(--r4-space-md);
	}
</style>
