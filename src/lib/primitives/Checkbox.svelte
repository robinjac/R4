<script lang="ts">
	interface Props {
		label: string;
		checked?: boolean;
		description?: string;
		error?: string;
		name?: string;
		required?: boolean;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let { label, checked = $bindable(false), description, error, name, required = false, disabled = false, onchange }: Props = $props();
	const id = $props.id();
	let describedBy = $derived([description ? `${id}-description` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined);

	function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
		checked = event.currentTarget.checked;
		onchange?.(checked);
	}
</script>

<label for={id} data-r4-primitive="Checkbox" class:disabled>
	<input {id} {name} type="checkbox" bind:checked {required} {disabled} aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined} onchange={handleChange} />
	<span class="copy"><span class="label">{label}</span>{#if description}<span id={`${id}-description`} class="description">{description}</span>{/if}{#if error}<span id={`${id}-error`} class="error">{error}</span>{/if}</span>
</label>

<style>
	label { display: flex; min-height: 44px; align-items: flex-start; gap: var(--r4-space-xs); cursor: pointer; }
	label.disabled { cursor: not-allowed; opacity: 0.55; }
	input { width: 20px; height: 20px; flex: 0 0 auto; margin: 2px 0 0; accent-color: var(--r4-color-accent); }
	input:focus-visible { outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 28%, transparent); outline-offset: 2px; }
	.copy { display: grid; gap: var(--r4-space-2xs); }
	.label { font: var(--r4-type-label); }
	.description, .error { font: var(--r4-type-caption); }
	.description { color: var(--r4-color-text-muted); }
	.error { color: var(--r4-color-danger); }
</style>
