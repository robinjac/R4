<script lang="ts">
	import type { WorkbenchHighlightedCode } from './types.js';

	let { code, label }: { code: WorkbenchHighlightedCode; label: string } = $props();
</script>

<div class="highlighted-code" aria-label={label}>
	<pre><code>{#each code.lines as line, lineIndex}{#each line as token}<span style:color={code.colors[token[1]]}>{token[0]}</span>{/each}{#if lineIndex < code.lines.length - 1}{'\n'}{/if}{/each}</code></pre>
</div>

<style>
	.highlighted-code {
		min-height: 100%;
		overflow: auto;
	}

	pre {
		min-width: max-content;
		min-height: 100%;
		margin: 0;
		background: transparent !important;
		padding: 17px;
		font: 0.67rem/1.6 var(--r4-font-mono);
		tab-size: 2;
	}

	code {
		font: inherit;
	}
</style>
