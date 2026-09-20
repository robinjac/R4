<script lang="ts">
	import { inspectStudioStaticProperties, type R4StudioEditableProperty, type R4StudioSetPropertyIntent } from './inspector.js';
	import type { R4StudioNodeRef, R4StudioSnapshot } from './types.js';

	let {
		snapshot,
		selectedRef,
		disabled = false,
		oncommit
	}: {
		snapshot: R4StudioSnapshot;
		selectedRef: R4StudioNodeRef;
		disabled?: boolean;
		oncommit: (intent: R4StudioSetPropertyIntent) => void | Promise<void>;
	} = $props();

	let properties = $derived(inspectStudioStaticProperties(snapshot, selectedRef));

	function intent(property: R4StudioEditableProperty, value: string | number | boolean): R4StudioSetPropertyIntent {
		return {
			id: crypto.randomUUID(),
			target: property.target,
			property: property.name,
			value
		};
	}

	function submitText(event: SubmitEvent, property: R4StudioEditableProperty) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const value = new FormData(form).get('value');
		if (typeof value === 'string') void oncommit(intent(property, value));
	}

	function submitNumber(event: SubmitEvent, property: R4StudioEditableProperty) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const raw = new FormData(form).get('value');
		if (typeof raw !== 'string' || raw.trim() === '') return;
		const value = Number(raw);
		if (Number.isFinite(value)) void oncommit(intent(property, value));
	}
</script>

<div class="properties" aria-label="Editable properties">
	{#if properties.length === 0}
		<div class="empty"><strong>Source-only selection</strong><span>No existing static scalar attributes can be edited safely for this node.</span></div>
	{:else}
		{#each properties as property (`${snapshot.document.revision}:${selectedRef.target.id}:${property.name}`)}
			{#if typeof property.value === 'boolean'}
				<label class="boolean-property">
					<span><strong>{property.name}</strong><small>{property.anchor.syntax}</small></span>
					<input
						type="checkbox"
						checked={property.value}
						{disabled}
						onchange={(event) => void oncommit(intent(property, event.currentTarget.checked))}
					/>
				</label>
			{:else}
				<form onsubmit={(event) => typeof property.value === 'number' ? submitNumber(event, property) : submitText(event, property)}>
					<label>
						<span><strong>{property.name}</strong><small>{property.anchor.syntax}</small></span>
						<input
							name="value"
							type={typeof property.value === 'number' ? 'number' : 'text'}
							step={typeof property.value === 'number' ? 'any' : undefined}
							value={property.value}
							{disabled}
						/>
					</label>
					<button type="submit" {disabled}>Apply</button>
				</form>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.properties {
		display: grid;
		gap: 10px;
	}

	form,
	.boolean-property {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 8px;
		border: 1px solid #343a3d;
		background: #161b1e;
		padding: 10px;
	}

	label > span,
	.boolean-property > span {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		grid-column: 1 / -1;
		gap: 10px;
	}

	strong {
		color: #f3f2ed;
		font: 650 0.67rem/1.2 var(--r4-font-sans);
	}

	small {
		color: #7f898d;
		font: 0.5rem/1 var(--r4-font-mono);
		text-transform: uppercase;
	}

	input[type='text'],
	input[type='number'] {
		min-width: 0;
		border: 1px solid #4c5559;
		background: #0d1113;
		color: #e9eceb;
		padding: 7px 8px;
		font: 0.65rem/1.2 var(--r4-font-mono);
	}

	input[type='checkbox'] {
		grid-column: 2;
		width: 18px;
		height: 18px;
		accent-color: #58a6ff;
	}

	button {
		border: 1px solid #5b6670;
		background: #26323a;
		color: #dbe9f6;
		padding: 7px 10px;
		font-size: 0.6rem;
		cursor: pointer;
	}

	button:disabled,
	input:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.empty {
		display: grid;
		gap: 7px;
		padding: 18px;
		color: #8e989b;
		text-align: center;
	}

	.empty strong {
		color: #d9dedd;
	}

	.empty span {
		font: 0.6rem/1.5 var(--r4-font-mono);
	}
</style>
