<script lang="ts">
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		label: string;
		value?: number | null;
		placeholder?: string;
		description?: string;
		error?: string;
		name?: string;
		min?: number;
		max?: number;
		step?: number;
		unit?: string;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		onchange?: (value: number | null) => void;
	}

	let { label, value = $bindable(null), placeholder, description, error, name, min, max, step, unit, required = false, disabled = false, readonly = false, onchange }: Props = $props();
	const id = $props.id();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
	let describedBy = $derived([description ? `${id}-description` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined);

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = event.currentTarget.value === '' ? null : event.currentTarget.valueAsNumber;
		onchange?.(value);
	}
</script>

<label {...studioRuntimeAttributes} for={id} data-r4-primitive="NumberInput">
	<span class="label">{label}{#if required}<span aria-hidden="true"> *</span>{/if}</span>
	<span class="control">
		<input {id} {name} type="number" value={value ?? ''} {placeholder} {min} {max} {step} {required} {disabled} {readonly} aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined} oninput={handleInput} />
		{#if unit}<span class="unit" aria-hidden="true">{unit}</span>{/if}
	</span>
	{#if description}<span id={`${id}-description`} class="description">{description}</span>{/if}
	{#if error}<span id={`${id}-error`} class="error">{error}</span>{/if}
</label>

<style>
	label { display: grid; gap: var(--r4-space-2xs); }
	.label { font: var(--r4-type-label); }
	.control { display: flex; align-items: center; border: 1px solid var(--r4-color-border-strong); border-radius: var(--r4-radius-sm); background: var(--r4-color-surface-raised); }
	.control:focus-within { border-color: var(--r4-color-accent); outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 24%, transparent); }
	input { width: 100%; min-height: 42px; border: 0; outline: 0; background: transparent; color: var(--r4-color-text); padding: 0 var(--r4-space-sm); font: var(--r4-type-body); }
	.unit { padding-right: var(--r4-space-sm); color: var(--r4-color-text-muted); font: var(--r4-type-caption); }
	.description, .error { font: var(--r4-type-caption); }
	.description { color: var(--r4-color-text-muted); }
	.error { color: var(--r4-color-danger); }
	label:has(input[aria-invalid='true']) .control { border-color: var(--r4-color-danger); }
</style>
