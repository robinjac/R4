<script lang="ts">
	import type { SelectOption } from '../types.js';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		label: string;
		options: SelectOption[];
		value?: string;
		placeholder?: string;
		description?: string;
		error?: string;
		name?: string;
		required?: boolean;
		disabled?: boolean;
		onchange?: (value: string) => void;
	}

	let { label, options, value = $bindable(''), placeholder, description, error, name, required = false, disabled = false, onchange }: Props = $props();
	const id = $props.id();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
	let describedBy = $derived([description ? `${id}-description` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined);

	function handleChange(event: Event & { currentTarget: HTMLSelectElement }) {
		value = event.currentTarget.value;
		onchange?.(value);
	}
</script>

<label {...studioRuntimeAttributes} for={id} data-r4-primitive="Select">
	<span class="label">{label}{#if required}<span aria-hidden="true"> *</span>{/if}</span>
	<select {id} {name} bind:value {required} {disabled} aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined} onchange={handleChange}>
		{#if placeholder}<option value="" disabled>{placeholder}</option>{/if}
		{#each options as option (option.value)}<option value={option.value} disabled={option.disabled}>{option.label}</option>{/each}
	</select>
	{#if description}<span id={`${id}-description`} class="description">{description}</span>{/if}
	{#if error}<span id={`${id}-error`} class="error">{error}</span>{/if}
</label>

<style>
	label { display: grid; gap: var(--r4-space-2xs); }
	.label { font: var(--r4-type-label); }
	select { width: 100%; min-height: 44px; border: 1px solid var(--r4-color-border-strong); border-radius: var(--r4-radius-sm); background: var(--r4-color-surface-raised); color: var(--r4-color-text); padding: 0 var(--r4-space-sm); font: var(--r4-type-body); }
	select:focus-visible { border-color: var(--r4-color-accent); outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 24%, transparent); }
	select[aria-invalid='true'] { border-color: var(--r4-color-danger); }
	.description, .error { font: var(--r4-type-caption); }
	.description { color: var(--r4-color-text-muted); }
	.error { color: var(--r4-color-danger); }
</style>
