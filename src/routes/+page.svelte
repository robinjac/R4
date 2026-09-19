<script lang="ts">
	import '$lib/tokens.css';
	import '../styles.css';
	import { onMount, setContext } from 'svelte';
	import { projectPlatform } from '$lib/policy.js';
	import { experiments } from '../workbench/registry.js';
	import type { R4Platform } from '$lib/compiler/index.js';

	type InspectorTab = 'source' | 'ast' | 'semantic' | 'platform' | 'output' | 'diagnostics';

	const platforms: Array<{ id: R4Platform; label: string }> = [
		{ id: 'web', label: 'Web' },
		{ id: 'ios', label: 'iOS' },
		{ id: 'android', label: 'Android' },
		{ id: 'macos', label: 'macOS' },
		{ id: 'windows', label: 'Windows' }
	];
	const tabs: Array<{ id: InspectorTab; label: string }> = [
		{ id: 'source', label: 'Source' },
		{ id: 'ast', label: 'AST' },
		{ id: 'semantic', label: 'Semantic IR' },
		{ id: 'platform', label: 'Platform IR' },
		{ id: 'output', label: 'Output' },
		{ id: 'diagnostics', label: 'Diagnostics' }
	];
	setContext('r4:embedded-page', true);

	let hydrated = $state(false);
	let selectedId = $state(experiments[0]?.id ?? '');
	let platform = $state<R4Platform>('web');
	let inspectorTab = $state<InspectorTab>('semantic');
	let platformLabel = $derived(platforms.find((item) => item.id === platform)?.label ?? platform);
	let selected = $derived(experiments.find((experiment) => experiment.id === selectedId) ?? experiments[0]);
	let ir = $derived(selected?.compilation.compiler.ir ?? null);
	let projection = $derived(ir ? projectPlatform(ir, platform) : null);
	let diagnostics = $derived([
		...(selected?.compilation.compiler.diagnostics ?? []),
		...(selected?.compilation.backends.lynx?.diagnostics ?? [])
	]);
	let errorCount = $derived(diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length);
	let warningCount = $derived(diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length);

	function formatted(value: unknown) {
		return JSON.stringify(value, null, 2);
	}

	onMount(() => {
		hydrated = true;
	});
</script>

<svelte:head>
	<title>R4 Workbench</title>
	<meta
		name="description"
		content="The browser-first research environment for R4 semantic UI, compiler, and platform policy experiments."
	/>
</svelte:head>

<div class="workbench-shell" data-hydrated={hydrated}>
	<header class="workbench-header">
		<div class="brand-lockup">
			<div class="brand-mark" aria-hidden="true">R4</div>
			<div>
				<strong>Workbench</strong>
				<span>semantic systems laboratory</span>
			</div>
		</div>

		<div class="platform-switcher" role="group" aria-label="Simulated platform">
			{#each platforms as item}
				<button type="button" class:active={platform === item.id} aria-pressed={platform === item.id} onclick={() => (platform = item.id)}>{item.label}</button>
			{/each}
		</div>

		<div class="build-state" class:has-errors={errorCount > 0} class:has-warnings={errorCount === 0 && warningCount > 0} role="status" aria-live="polite">
			<span class="status-light" aria-hidden="true"></span>
			<span>{errorCount > 0 ? `${errorCount} errors` : warningCount > 0 ? `${warningCount} warnings` : 'portable subset'}</span>
		</div>
	</header>

	<aside class="research-nav" aria-label="Research experiments">
		<div class="rail-heading">
			<span>Research index</span>
			<small>{String(experiments.length).padStart(2, '0')}</small>
		</div>

		<nav>
			{#each experiments as experiment, index}
				<button
					type="button"
					class:active={selected?.id === experiment.id}
					aria-current={selected?.id === experiment.id ? 'page' : undefined}
					onclick={() => (selectedId = experiment.id)}
				>
					<span class="experiment-number">{String(index + 1).padStart(2, '0')}</span>
					<span class="experiment-copy">
						<strong>{experiment.title}</strong>
						<small>{experiment.group}</small>
					</span>
					<span class="decision" data-status={experiment.status ?? 'explore'}>{experiment.status ?? 'explore'}</span>
				</button>
			{/each}
		</nav>

		<div class="rail-note">
			<span>Method</span>
			<p>Idea / composition / semantics / policy / decision</p>
		</div>
	</aside>

	<main class="stage">
		<section class="experiment-header">
			<div>
				<span class="eyebrow">{selected?.group ?? 'Experiment'} / {selected?.id}</span>
				<h1>{selected?.title}</h1>
				<p>{selected?.description}</p>
			</div>
			<div class="source-path">{selected?.path}</div>
		</section>

		<section class="preview-section" aria-label="Platform preview">
			<div class="preview-toolbar">
				<div>
					<span class="live-dot" aria-hidden="true"></span>
					<strong>{platform === 'web' ? 'Actual web runtime' : `Simulated ${platformLabel} policy`}</strong>
				</div>
				<span>{platform === 'web' ? 'SSR + hydration' : 'Browser approximation, not native execution'}</span>
			</div>

			<div class="preview-field" data-platform={platform}>
				<div class="device-frame" data-r4-platform={platform}>
					<div class="device-chrome">
						<span></span><span></span><span></span>
						<small>{platform === 'web' ? 'localhost:3000/experiment' : `R4 ${platformLabel} simulation`}</small>
					</div>
					<div class="experiment-canvas">
						{#if selected}
							{@const Preview = selected.component}
							<Preview />
						{/if}
					</div>
				</div>
			</div>
		</section>

		<div class="pipeline" role="group" aria-label="Compilation pipeline">
			{#each tabs.slice(0, 5) as tab, index}
				<button type="button" class:active={inspectorTab === tab.id} aria-pressed={inspectorTab === tab.id} onclick={() => (inspectorTab = tab.id)}>
					<span>{String(index + 1).padStart(2, '0')}</span>
					<strong>{tab.label}</strong>
				</button>
				{#if index < 4}<i aria-hidden="true"></i>{/if}
			{/each}
		</div>
	</main>

	<aside class="inspector" aria-label="Compiler inspector">
		<div class="inspector-header">
			<div>
				<span>Inspector</span>
				<strong>{tabs.find((tab) => tab.id === inspectorTab)?.label}</strong>
			</div>
			<button type="button" class="diagnostic-button" aria-label={`${errorCount} errors and ${warningCount} warnings. Show diagnostics.`} aria-pressed={inspectorTab === 'diagnostics'} onclick={() => (inspectorTab = 'diagnostics')}>
				<span class:error={errorCount > 0}>{errorCount}</span>
				<span class:warning={warningCount > 0}>{warningCount}</span>
			</button>
		</div>

		<div class="inspector-tabs" role="group" aria-label="Inspector view">
			{#each tabs as tab}
				<button type="button" class:active={inspectorTab === tab.id} aria-pressed={inspectorTab === tab.id} onclick={() => (inspectorTab = tab.id)}>{tab.label}</button>
			{/each}
		</div>

		<div class="inspector-content">
			{#if inspectorTab === 'source'}
				<pre><code>{selected?.source}</code></pre>
			{:else if inspectorTab === 'ast'}
				<pre><code>{formatted(selected?.compilation.compiler.ast)}</code></pre>
			{:else if inspectorTab === 'semantic'}
				<pre><code>{formatted(ir)}</code></pre>
			{:else if inspectorTab === 'platform'}
				<div class="inspector-summary">
					<span>{projection?.mode}</span>
					<strong>{projection?.renderer}</strong>
				</div>
				<pre><code>{formatted(projection)}</code></pre>
			{:else if inspectorTab === 'output'}
				{#if platform === 'web'}
					<div class="output-note">
						<strong>Direct Svelte web lowering</strong>
						<p>The rendered preview is the output. SvelteKit owns server rendering, HTML, CSS, hydration, and client updates.</p>
					</div>
					<pre><code>{formatted(projection)}</code></pre>
				{:else}
					<div class="output-note experimental">
						<strong>Lynx backend experiment</strong>
						<p>Generated ReactLynx is below the backend boundary and is not part of the R4 authoring API.</p>
					</div>
					<pre><code>{selected?.compilation.backends.lynx?.files['src/generated.tsx'] ?? 'No Lynx artifact generated.'}</code></pre>
				{/if}
			{:else}
				<div class="diagnostic-list">
					{#if diagnostics.length === 0}
						<div class="empty-state"><strong>No diagnostics</strong><span>This experiment fits the current portable subset.</span></div>
					{:else}
						{#each diagnostics as diagnostic}
							<article data-severity={diagnostic.severity}>
								<div><span>{diagnostic.severity}</span><code>{diagnostic.code}</code></div>
								<strong>{diagnostic.message}</strong>
								{#if diagnostic.platforms}<small>{diagnostic.platforms.join(' / ')}</small>{/if}
								{#if diagnostic.suggestion}<p>{diagnostic.suggestion}</p>{/if}
							</article>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</aside>
</div>
