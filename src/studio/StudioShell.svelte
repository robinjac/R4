<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import type { R4Diagnostic } from '../lib/compiler/index.js';
	import { MAX_STUDIO_SOURCE_LENGTH } from './analyze.js';
	import type { R4StudioAnalyzeRequest, R4StudioAnalyzeResponse, R4StudioSnapshot } from './types.js';

	type AnalysisView = 'diagnostics' | 'semantic' | 'ast' | 'snapshot';
	type StudioState = 'starting' | 'analyzing' | 'ready' | 'failed';

	const documentId = 'studio/Untitled.r4.svelte';
	const views: Array<{ id: AnalysisView; label: string }> = [
		{ id: 'diagnostics', label: 'Diagnostics' },
		{ id: 'semantic', label: 'Semantic IR' },
		{ id: 'ast', label: 'Svelte AST' },
		{ id: 'snapshot', label: 'Snapshot' }
	];
	const starterSource = `<script lang="ts">
\timport { Button, Page, Stack, Text } from 'r4';

\tlet count = $state(0);
<\/script>

<Page title="Studio draft" description="Browser compiler boundary">
\t<Stack gap="md">
\t\t<Text role="heading">Count: {count}</Text>
\t\t<Button onclick={() => count++}>Increment</Button>
\t</Stack>
</Page>
`;

	let source = $state(starterSource);
	let snapshot = $state<R4StudioSnapshot | null>(null);
	let activeView = $state<AnalysisView>('diagnostics');
	let studioState = $state<StudioState>('starting');
	let failure = $state('');
	let worker = $state.raw<Worker | null>(null);
	let currentRequestId = 0;
	let diagnostics = $derived(snapshot?.compilation.diagnostics ?? []);
	let errorCount = $derived(diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length);
	let warningCount = $derived(diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length);
	let statusLabel = $derived(
		studioState === 'starting'
			? 'Starting browser compiler'
			: studioState === 'analyzing'
				? 'Analyzing source'
				: studioState === 'failed'
					? 'Analysis failed'
					: errorCount > 0
						? `${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`
						: warningCount > 0
							? `${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`
							: 'Portable subset'
	);

	onMount(() => {
		worker = new Worker(new URL('./analyzer.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = handleWorkerMessage;
		worker.onerror = () => {
			failure = 'The browser compiler worker stopped unexpectedly.';
			studioState = 'failed';
		};
		analyze();
		return () => worker?.terminate();
	});

	function analyze() {
		if (!worker) return;
		const request: R4StudioAnalyzeRequest = {
			type: 'analyze',
			requestId: ++currentRequestId,
			documentId,
			source
		};
		failure = '';
		studioState = 'analyzing';
		worker.postMessage(request);
	}

	function handleWorkerMessage(event: MessageEvent<R4StudioAnalyzeResponse>) {
		const response = event.data;
		if (response.requestId !== currentRequestId) return;
		if (response.type === 'failure') {
			failure = response.message;
			studioState = 'failed';
			return;
		}
		snapshot = response.snapshot;
		studioState = 'ready';
		if (response.snapshot.compilation.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) activeView = 'diagnostics';
	}

	function handleEditorKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			analyze();
		}
	}

	function diagnosticLocation(diagnostic: R4Diagnostic) {
		return diagnostic.range ? `${diagnostic.range.start.line}:${diagnostic.range.start.column + 1}` : 'project';
	}
</script>

<div class="studio-shell" data-state={studioState}>
	<header class="studio-header">
		<a class="brand" href={`${base}/studio/`} aria-label="R4 Studio home">
			<span class="brand-mark" aria-hidden="true">R4</span>
			<span><strong>Studio</strong><small>browser compiler boundary</small></span>
		</a>
		<div class="document-identity">
			<span>Document</span>
			<strong>{documentId}</strong>
		</div>
		<nav aria-label="R4 development environments">
			<a href={`${base}/studio/`}>Project</a>
			<a href={`${base}/`}>Workbench</a>
		</nav>
	</header>

	<main>
		<section class="source-pane" aria-labelledby="source-heading">
			<header class="pane-header">
				<div>
					<span class="pane-index">01</span>
					<div><h1 id="source-heading">Source</h1><p>Authoritative R4/Svelte document</p></div>
				</div>
				<button type="button" class="analyze-button" onclick={analyze} disabled={!worker || studioState === 'analyzing'}>
					{studioState === 'analyzing' ? 'Analyzing...' : 'Analyze'}
					<kbd>Cmd/Ctrl Enter</kbd>
				</button>
			</header>
			<div class="editor-meta">
				<span>R4 / Svelte 5</span>
				<span class:near-limit={source.length > MAX_STUDIO_SOURCE_LENGTH * 0.9}>{source.length.toLocaleString('en-US')} / {MAX_STUDIO_SOURCE_LENGTH.toLocaleString('en-US')}</span>
			</div>
			<label class="editor-label" for="studio-source">R4 source</label>
			<textarea id="studio-source" bind:value={source} onkeydown={handleEditorKeydown} spellcheck="false" aria-describedby="source-note"></textarea>
			<p id="source-note" class="source-note">Draft source is analyzed locally and is not executed. Changes are not written to disk.</p>
		</section>

		<section class="analysis-pane" aria-labelledby="analysis-heading">
			<header class="pane-header analysis-header">
				<div>
					<span class="pane-index">02</span>
					<div><h2 id="analysis-heading">Analysis</h2><p>Derived, disposable compiler evidence</p></div>
				</div>
				<div class="compiler-state" class:has-errors={errorCount > 0 || studioState === 'failed'} class:has-warnings={errorCount === 0 && warningCount > 0} role="status" aria-live="polite">
					<span aria-hidden="true"></span>{statusLabel}
				</div>
			</header>

			<div class="analysis-facts">
				<div><span>Snapshot</span><strong>{snapshot ? `v${snapshot.version}` : '--'}</strong></div>
				<div><span>Semantic IR</span><strong>{snapshot?.compilation.ir ? `v${snapshot.compilation.ir.version}` : '--'}</strong></div>
				<div><span>Revision</span><strong title={snapshot?.document.revision}>{snapshot?.document.revision.slice(0, 10) ?? '--'}</strong></div>
			</div>

			<div class="analysis-tabs" role="tablist" aria-label="Analysis view">
				{#each views as view}
					<button
						type="button"
						role="tab"
						aria-selected={activeView === view.id}
						aria-controls="analysis-content"
						class:active={activeView === view.id}
						onclick={() => (activeView = view.id)}
					>{view.label}{#if view.id === 'diagnostics'}<span>{diagnostics.length}</span>{/if}</button>
				{/each}
			</div>

			<div id="analysis-content" class="analysis-content" role="tabpanel">
				{#if failure}
					<div class="failure"><strong>Compiler worker failure</strong><p>{failure}</p></div>
				{:else if !snapshot}
					<div class="empty-state"><span>R4</span><p>The browser compiler is loading.</p></div>
				{:else if activeView === 'diagnostics'}
					{#if diagnostics.length === 0}
						<div class="empty-state success"><span>00</span><p>No diagnostics for this snapshot.</p></div>
					{:else}
						<ul class="diagnostic-list">
							{#each diagnostics as diagnostic}
								<li data-severity={diagnostic.severity}>
									<div><strong>{diagnostic.code}</strong><span>{diagnostic.severity} / {diagnosticLocation(diagnostic)}</span></div>
									<p>{diagnostic.message}</p>
									{#if diagnostic.suggestion}<small>{diagnostic.suggestion}</small>{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{:else if activeView === 'semantic'}
					<pre aria-label="Studio Semantic IR">{JSON.stringify(snapshot.compilation.ir, null, 2)}</pre>
				{:else if activeView === 'ast'}
					<pre aria-label="Studio Svelte AST">{JSON.stringify(snapshot.compilation.ast, null, 2)}</pre>
				{:else}
					<pre aria-label="Studio snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
				{/if}
			</div>
		</section>
	</main>
</div>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html) {
		background: #d7d5ce;
	}

	:global(body) {
		margin: 0;
		background: #d7d5ce;
		color: #171b1e;
		font-family: var(--r4-font-sans);
	}

	:global(button),
	:global(textarea) {
		font: inherit;
	}

	:global(a:focus-visible),
	:global(button:focus-visible),
	:global(textarea:focus-visible) {
		outline: 3px solid #005bd7;
		outline-offset: -3px;
	}

	.studio-shell {
		min-height: 100svh;
		background: #d7d5ce;
	}

	.studio-header {
		display: grid;
		grid-template-columns: minmax(220px, 0.8fr) minmax(280px, 1fr) auto;
		min-height: 66px;
		border-bottom: 1px solid #8f908b;
		background: #eceae3;
	}

	.brand,
	.document-identity,
	.studio-header nav {
		display: flex;
		align-items: center;
	}

	.brand {
		gap: 11px;
		border-right: 1px solid #b8b5ad;
		padding: 10px 16px;
		color: inherit;
		text-decoration: none;
	}

	.brand-mark {
		display: grid;
		width: 38px;
		height: 38px;
		place-items: center;
		background: #171b1e;
		color: #fffdf6;
		font: 700 0.78rem/1 var(--r4-font-mono);
	}

	.brand > span:last-child {
		display: grid;
		gap: 3px;
	}

	.brand strong {
		font-size: 0.9rem;
	}

	.brand small,
	.document-identity span {
		color: #697074;
		font: 0.58rem/1 var(--r4-font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.document-identity {
		align-items: flex-start;
		justify-content: center;
		flex-direction: column;
		gap: 6px;
		padding: 10px 18px;
	}

	.document-identity strong {
		font: 0.72rem/1 var(--r4-font-mono);
	}

	.studio-header nav {
		border-left: 1px solid #b8b5ad;
	}

	.studio-header nav a {
		display: grid;
		height: 100%;
		place-items: center;
		padding: 0 22px;
		color: #005bd7;
		font: 650 0.65rem/1 var(--r4-font-mono);
		letter-spacing: 0.05em;
		text-decoration: none;
		text-transform: uppercase;
	}

	main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(420px, 0.82fr);
		min-height: calc(100svh - 66px);
	}

	.source-pane,
	.analysis-pane {
		display: grid;
		min-width: 0;
		min-height: 0;
	}

	.source-pane {
		grid-template-rows: auto auto minmax(420px, 1fr) auto;
		border-right: 1px solid #8f908b;
		background: #f5f2ea;
	}

	.analysis-pane {
		grid-template-rows: auto auto auto minmax(0, 1fr);
		background: #202528;
		color: #edf0ed;
	}

	.pane-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 88px;
		border-bottom: 1px solid #b8b5ad;
		padding: 14px 18px;
	}

	.pane-header > div:first-child {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.pane-index {
		color: #005bd7;
		font: 0.65rem/1 var(--r4-font-mono);
	}

	.pane-header h1,
	.pane-header h2 {
		margin: 0;
		font: 650 1.05rem/1.1 var(--r4-font-sans);
	}

	.pane-header p {
		margin: 5px 0 0;
		color: #6e7476;
		font: 0.66rem/1.2 var(--r4-font-mono);
	}

	.analysis-header {
		border-color: #3a4145;
	}

	.analysis-header p {
		color: #8e989d;
	}

	.analyze-button {
		display: flex;
		align-items: center;
		gap: 12px;
		border: 0;
		background: #005bd7;
		padding: 10px 12px;
		color: white;
		font: 650 0.7rem/1 var(--r4-font-mono);
		cursor: pointer;
	}

	.analyze-button:disabled {
		background: #9ca3a4;
		cursor: wait;
	}

	kbd {
		border-left: 1px solid rgb(255 255 255 / 35%);
		padding-left: 10px;
		font: 0.52rem/1 var(--r4-font-mono);
		opacity: 0.8;
	}

	.editor-meta,
	.source-note {
		display: flex;
		justify-content: space-between;
		margin: 0;
		color: #72787a;
		font: 0.6rem/1 var(--r4-font-mono);
	}

	.editor-meta {
		border-bottom: 1px solid #cfcbc2;
		padding: 9px 18px;
	}

	.near-limit {
		color: #b42318;
	}

	.editor-label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	textarea {
		width: 100%;
		height: 100%;
		min-height: 420px;
		resize: none;
		border: 0;
		border-radius: 0;
		background: #fffdf6;
		padding: 22px;
		color: #22272a;
		font: 0.83rem/1.65 var(--r4-font-mono);
		tab-size: 2;
	}

	.source-note {
		border-top: 1px solid #cfcbc2;
		padding: 11px 18px;
	}

	.compiler-state {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #aeb7b4;
		font: 0.62rem/1 var(--r4-font-mono);
		text-transform: uppercase;
	}

	.compiler-state > span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #53cc87;
		box-shadow: 0 0 0 3px rgb(83 204 135 / 12%);
	}

	.compiler-state.has-errors > span {
		background: #ff6b62;
		box-shadow: 0 0 0 3px rgb(255 107 98 / 12%);
	}

	.compiler-state.has-warnings > span {
		background: #f2be5c;
		box-shadow: 0 0 0 3px rgb(242 190 92 / 12%);
	}

	.analysis-facts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-bottom: 1px solid #3a4145;
	}

	.analysis-facts div {
		display: grid;
		gap: 7px;
		border-right: 1px solid #3a4145;
		padding: 13px 16px;
	}

	.analysis-facts div:last-child {
		border: 0;
	}

	.analysis-facts span {
		color: #7f898e;
		font: 0.55rem/1 var(--r4-font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.analysis-facts strong {
		overflow: hidden;
		font: 0.72rem/1 var(--r4-font-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.analysis-tabs {
		display: flex;
		overflow-x: auto;
		border-bottom: 1px solid #3a4145;
	}

	.analysis-tabs button {
		display: flex;
		align-items: center;
		gap: 7px;
		border: 0;
		border-right: 1px solid #3a4145;
		background: transparent;
		padding: 11px 14px;
		color: #8f999e;
		font: 0.61rem/1 var(--r4-font-mono);
		white-space: nowrap;
		cursor: pointer;
	}

	.analysis-tabs button.active {
		background: #2a3033;
		color: white;
		box-shadow: inset 0 -2px #54a0ff;
	}

	.analysis-tabs button span {
		display: grid;
		min-width: 18px;
		height: 18px;
		place-items: center;
		border-radius: 50%;
		background: #3a4145;
		font-size: 0.52rem;
	}

	.analysis-content {
		min-height: 0;
		overflow: auto;
	}

	pre {
		min-height: 100%;
		margin: 0;
		padding: 20px;
		color: #d7e1df;
		font: 0.7rem/1.55 var(--r4-font-mono);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.empty-state,
	.failure {
		display: grid;
		min-height: 320px;
		place-content: center;
		justify-items: center;
		padding: 30px;
		text-align: center;
	}

	.empty-state span {
		display: grid;
		width: 54px;
		height: 54px;
		place-items: center;
		border: 1px solid #4b5559;
		color: #8f999e;
		font: 0.7rem/1 var(--r4-font-mono);
	}

	.empty-state.success span {
		border-color: #3d7758;
		color: #70d39a;
	}

	.empty-state p,
	.failure p {
		max-width: 330px;
		margin: 14px 0 0;
		color: #899398;
		font: 0.72rem/1.5 var(--r4-font-mono);
	}

	.failure strong {
		color: #ff8c85;
	}

	.diagnostic-list {
		display: grid;
		gap: 1px;
		margin: 0;
		padding: 0;
		background: #3a4145;
		list-style: none;
	}

	.diagnostic-list li {
		background: #252b2e;
		padding: 16px 18px;
		box-shadow: inset 3px 0 #829097;
	}

	.diagnostic-list li[data-severity='error'] {
		box-shadow: inset 3px 0 #ff6b62;
	}

	.diagnostic-list li[data-severity='warning'] {
		box-shadow: inset 3px 0 #f2be5c;
	}

	.diagnostic-list li > div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}

	.diagnostic-list strong,
	.diagnostic-list span,
	.diagnostic-list small {
		font: 0.61rem/1.3 var(--r4-font-mono);
	}

	.diagnostic-list span {
		color: #8f999e;
		text-transform: uppercase;
	}

	.diagnostic-list p {
		margin: 9px 0 0;
		color: #d5dcda;
		font-size: 0.78rem;
		line-height: 1.5;
	}

	.diagnostic-list small {
		display: block;
		margin-top: 9px;
		color: #8ab8ef;
	}

	@media (max-width: 920px) {
		.studio-header {
			grid-template-columns: 1fr auto;
		}

		.document-identity {
			display: none;
		}

		main {
			grid-template-columns: 1fr;
		}

		.source-pane {
			border-right: 0;
			border-bottom: 1px solid #8f908b;
		}

		.analysis-pane {
			min-height: 680px;
		}
	}

	@media (max-width: 560px) {
		.studio-header {
			min-height: 58px;
		}

		.brand {
			padding: 8px 10px;
		}

		.brand small {
			display: none;
		}

		.studio-header nav a {
			padding: 0 13px;
		}

		.pane-header {
			align-items: flex-start;
			flex-direction: column;
			gap: 14px;
		}

		.analyze-button {
			width: 100%;
			justify-content: space-between;
		}

		.analysis-header .compiler-state {
			padding-left: 29px;
		}

		textarea {
			min-height: 480px;
			padding: 16px;
			font-size: 0.74rem;
		}

		.source-note {
			line-height: 1.45;
		}
	}
</style>
