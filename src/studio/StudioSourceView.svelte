<script lang="ts">
	import { tick } from 'svelte';
	import type { SourceRange } from '../lib/compiler/index.js';

	let {
		source,
		range = null,
		label = 'Project source'
	}: {
		source: string;
		range?: SourceRange | null;
		label?: string;
	} = $props();
	let selectedSource = $state.raw<HTMLElement>();
	let before = $derived(range ? source.slice(0, range.start.offset) : source);
	let selected = $derived(range ? source.slice(range.start.offset, range.end.offset) : '');
	let after = $derived(range ? source.slice(range.end.offset) : '');

	$effect(() => {
		range;
		void tick().then(() => selectedSource?.scrollIntoView({ block: 'center', inline: 'nearest' }));
	});
</script>

<section class="source-view" aria-label={label}>
	<header>
		<span>{source.split('\n').length} lines</span>
		<strong>{range ? `Selected ${range.start.line}:${range.start.column + 1}-${range.end.line}:${range.end.column + 1}` : 'Entire document'}</strong>
	</header>
	<pre><code>{before}{#if range}<mark bind:this={selectedSource}>{selected || ' '}</mark>{after}{/if}</code></pre>
</section>

<style>
	.source-view {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 100%;
		background: #202528;
		color: #d7e1df;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		border-bottom: 1px solid #3a4145;
		padding: 10px 13px;
		color: #849095;
		font: 0.55rem/1 var(--r4-font-mono);
		text-transform: uppercase;
	}

	header strong {
		overflow: hidden;
		color: #b8c3c6;
		font: inherit;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	pre {
		min-height: 0;
		margin: 0;
		overflow: auto;
		padding: 18px;
		font: 0.69rem/1.58 var(--r4-font-mono);
		tab-size: 2;
		white-space: pre-wrap;
		word-break: break-word;
	}

	code {
		font: inherit;
	}

	mark {
		border-radius: 2px;
		background: #174c73;
		box-shadow: 0 0 0 2px #2778af;
		color: #f4fbff;
	}
</style>
