<script lang="ts">
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		label: string;
		value?: string;
		placeholder?: string;
		description?: string;
		error?: string;
		name?: string;
		rows?: number;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		onchange?: (value: string) => void;
	}

	let {
		label,
		value = $bindable(''),
		placeholder,
		description,
		error,
		name,
		rows = 4,
		required = false,
		disabled = false,
		readonly = false,
		onchange
	}: Props = $props();
	const id = $props.id();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
	let describedBy = $derived([description ? `${id}-description` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined);

	function handleInput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		value = event.currentTarget.value;
		onchange?.(value);
	}
</script>

<label {...studioRuntimeAttributes} for={id} data-r4-primitive="Textarea">
	<span class="label">{label}{#if required}<span aria-hidden="true"> *</span>{/if}</span>
	<textarea {id} {name} bind:value {placeholder} {rows} {required} {disabled} {readonly} aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined} oninput={handleInput}></textarea>
	{#if description}<span id={`${id}-description`} class="description">{description}</span>{/if}
	{#if error}<span id={`${id}-error`} class="error">{error}</span>{/if}
</label>

<style>
	label { display: grid; gap: var(--r4-space-2xs); }
	.label { font: var(--r4-type-label); }
	.description, .error { font: var(--r4-type-caption); }
	.description { color: var(--r4-color-text-muted); }
	.error { color: var(--r4-color-danger); }
	textarea { min-height: 96px; resize: vertical; border: 1px solid var(--r4-color-border-strong); border-radius: var(--r4-radius-sm); background: var(--r4-color-surface-raised); color: var(--r4-color-text); padding: var(--r4-space-sm); font: var(--r4-type-body); }
	textarea:focus-visible { border-color: var(--r4-color-accent); outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 24%, transparent); }
	textarea[aria-invalid='true'] { border-color: var(--r4-color-danger); }
</style>
