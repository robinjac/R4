<script lang="ts">
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		label: string;
		checked?: boolean;
		disabled?: boolean;
		required?: boolean;
		description?: string;
		error?: string;
		name?: string;
		onchange?: (checked: boolean) => void;
	}

	let { label, checked = $bindable(false), disabled = false, required = false, description, error, name, onchange }: Props = $props();
	const id = $props.id();
	const studioRuntimeAttributes = getStudioRuntimeAttributes();
	let describedBy = $derived([description ? `${id}-description` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined);

	function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
		checked = event.currentTarget.checked;
		onchange?.(checked);
	}
</script>

<label {...studioRuntimeAttributes} for={id} data-r4-primitive="Switch" class:disabled>
	<span class="copy">
		<span class="label">{label}{#if required}<span aria-hidden="true"> *</span>{/if}</span>
		{#if description}<span id={`${id}-description`} class="description">{description}</span>{/if}
		{#if error}<span id={`${id}-error`} class="error">{error}</span>{/if}
	</span>
	<span class="control">
		<input
			{id}
			{name}
			type="checkbox"
			role="switch"
			bind:checked
			{disabled}
			{required}
			aria-describedby={describedBy}
			aria-invalid={error ? 'true' : undefined}
			onchange={handleChange}
		/>
		<span class="track" aria-hidden="true"><span class="thumb"></span></span>
	</span>
</label>

<style>
	label {
		display: flex;
		min-height: 44px;
		align-items: center;
		justify-content: space-between;
		gap: var(--r4-space-md);
		cursor: pointer;
	}

	label.disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.copy {
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

	.control {
		display: inline-grid;
		position: relative;
		width: 44px;
		height: 26px;
		flex: 0 0 auto;
		place-items: center;
	}

	input {
		position: absolute;
		z-index: 1;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		cursor: inherit;
		opacity: 0;
	}

	.track {
		display: flex;
		width: 44px;
		height: 26px;
		align-items: center;
		border: 1px solid var(--r4-color-border-strong);
		border-radius: var(--r4-radius-full);
		background: var(--r4-color-border);
		padding: 2px;
		transition: background 140ms ease, border-color 140ms ease;
	}

	.thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--r4-color-surface-raised);
		box-shadow: 0 1px 3px rgb(23 27 30 / 24%);
		transition: transform 140ms ease;
	}

	input:checked + .track {
		border-color: var(--r4-color-accent);
		background: var(--r4-color-accent);
	}

	input:checked + .track .thumb {
		transform: translateX(18px);
	}

	input:focus-visible + .track {
		outline: 3px solid color-mix(in srgb, var(--r4-color-accent) 28%, transparent);
		outline-offset: 2px;
	}
</style>
