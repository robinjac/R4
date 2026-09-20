<script lang="ts">
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		label: string;
		value?: string;
		description?: string;
		error?: string;
		name?: string;
		min?: string;
		max?: string;
		step?: number;
		required?: boolean;
		disabled?: boolean;
		onchange?: (value: string) => void;
	}

	let { label, value = $bindable(''), description, error, name, min, max, step, required = false, disabled = false, onchange }: Props = $props();
	const id = $props.id();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
	let describedBy = $derived([description ? `${id}-description` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined);
	function handleChange(event: Event & { currentTarget: HTMLInputElement }) { value = event.currentTarget.value; onchange?.(value); }
</script>

<label {...studioRuntimeAttributes} for={id} data-r4-primitive="TimeInput">
	<span class="label">{label}</span>
	<input {id} {name} type="time" bind:value {min} {max} {step} {required} {disabled} aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined} onchange={handleChange} />
	{#if description}<span id={`${id}-description`} class="description">{description}</span>{/if}
	{#if error}<span id={`${id}-error`} class="error">{error}</span>{/if}
</label>

<style>
	label { display: grid; gap: var(--r4-space-2xs); }
	.label { font: var(--r4-type-label); }
	input { min-height: 44px; border: 1px solid var(--r4-color-border-strong); border-radius: var(--r4-radius-sm); background: var(--r4-color-surface-raised); color: var(--r4-color-text); padding: 0 var(--r4-space-sm); font: var(--r4-type-body); }
	input:focus-visible { border-color: var(--r4-color-accent); outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 24%, transparent); }
	input[aria-invalid='true'] { border-color: var(--r4-color-danger); }
	.description, .error { font: var(--r4-type-caption); }
	.description { color: var(--r4-color-text-muted); }
	.error { color: var(--r4-color-danger); }
</style>
