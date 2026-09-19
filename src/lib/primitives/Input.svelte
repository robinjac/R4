<script lang="ts">
	interface Props {
		label: string;
		value?: string;
		placeholder?: string;
		type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
		disabled?: boolean;
		description?: string;
		oninput?: (event: Event & { currentTarget: HTMLInputElement }) => void;
	}

	let {
		label,
		value = $bindable(''),
		placeholder,
		type = 'text',
		disabled = false,
		description,
		oninput
	}: Props = $props();
	const id = $props.id();

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = event.currentTarget.value;
		oninput?.(event);
	}
</script>

<label for={id} data-r4-primitive="Input">
	<span class="label">{label}</span>
	<input {id} {type} bind:value {placeholder} {disabled} aria-describedby={description ? `${id}-description` : undefined} oninput={handleInput} />
	{#if description}<span id={`${id}-description`} class="description">{description}</span>{/if}
</label>

<style>
	label {
		display: grid;
		gap: var(--r4-space-2xs);
	}

	.label {
		font: var(--r4-type-label);
	}

	.description {
		color: var(--r4-color-text-muted);
		font: var(--r4-type-caption);
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
</style>
