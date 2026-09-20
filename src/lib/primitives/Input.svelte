<script lang="ts">
	interface Props {
		label: string;
		value?: string;
		placeholder?: string;
		type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		description?: string;
		error?: string;
		name?: string;
		onchange?: (value: string) => void;
	}

	let {
		label,
		value = $bindable(''),
		placeholder,
		type = 'text',
		disabled = false,
		readonly = false,
		required = false,
		description,
		error,
		name,
		onchange
	}: Props = $props();
	const id = $props.id();
	let describedBy = $derived([description ? `${id}-description` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined);

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = event.currentTarget.value;
		onchange?.(value);
	}
</script>

<label for={id} data-r4-primitive="Input">
	<span class="label">{label}{#if required}<span aria-hidden="true"> *</span>{/if}</span>
	<input {id} {name} {type} bind:value {placeholder} {disabled} {readonly} {required} aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined} oninput={handleInput} />
	{#if description}<span id={`${id}-description`} class="description">{description}</span>{/if}
	{#if error}<span id={`${id}-error`} class="error">{error}</span>{/if}
</label>

<style>
	label {
		display: grid;
		gap: var(--r4-space-2xs);
	}

	.label {
		font: var(--r4-type-label);
	}

	.description,
	.error {
		font: var(--r4-type-caption);
	}

	.description {
		color: var(--r4-color-text-muted);
	}

	.error {
		color: var(--r4-color-danger);
	}

	input {
		min-height: 44px;
		border: 1px solid var(--r4-color-border-strong);
		border-radius: var(--r4-radius-sm);
		background: var(--r4-color-surface-raised);
		color: var(--r4-color-text);
		padding: 0 var(--r4-space-sm);
		font: var(--r4-type-body);
	}

	input:focus-visible {
		border-color: var(--r4-color-accent);
		outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 24%, transparent);
	}

	input[aria-invalid='true'] {
		border-color: var(--r4-color-danger);
	}
</style>
