<script lang="ts">
	interface Props {
		label: string;
		value?: number;
		max?: number;
	}

	let { label, value, max = 100 }: Props = $props();
</script>

<label data-r4-primitive="Progress">
	<span>{label}</span>
	<progress {max} value={value}></progress>
	{#if value !== undefined}<small>{Math.round((value / max) * 100)}%</small>{/if}
</label>

<style>
	label { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--r4-space-xs); font: var(--r4-type-caption); }
	progress { grid-column: 1 / -1; width: 100%; height: 8px; border: 0; border-radius: var(--r4-radius-full); accent-color: var(--r4-color-accent); }
	small { color: var(--r4-color-text-muted); font: inherit; }
</style>
