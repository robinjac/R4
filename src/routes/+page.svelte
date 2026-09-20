<script lang="ts">
	import '$lib/tokens.css';
	import '../styles.css';
	import { onMount, setContext } from 'svelte';
	import { isPrimitiveName, primitiveManifest, type PrimitiveName } from '$lib/manifest.js';
	import { projectPlatform } from '$lib/policy.js';
	import { experiments } from '../workbench/registry.js';
	import CompositionTree from '../workbench/CompositionTree.svelte';
	import HighlightedCode from '../workbench/HighlightedCode.svelte';
	import type { R4Platform } from '$lib/compiler/index.js';
	import type { WorkbenchHighlighting } from '../workbench/types.js';

	type InspectorTab = 'source' | 'composition' | 'ast' | 'semantic' | 'platform' | 'output' | 'diagnostics';
	type ResizeTarget = 'navigation' | 'inspector';
	type ResizeState = {
		target: ResizeTarget;
		startX: number;
		startY: number;
		startNavWidth: number;
		startInspectorWidth: number;
		startInspectorHeight: number;
	};

	const defaultNavWidth = 230;
	const defaultInspectorWidth = 430;
	const defaultInspectorHeight = 520;

	const platforms: Array<{ id: R4Platform; label: string }> = [
		{ id: 'web', label: 'Web' },
		{ id: 'ios', label: 'iOS' },
		{ id: 'android', label: 'Android' },
		{ id: 'macos', label: 'macOS' },
		{ id: 'windows', label: 'Windows' }
	];
	const tabs: Array<{ id: InspectorTab; label: string }> = [
		{ id: 'source', label: 'Source' },
		{ id: 'composition', label: 'Composition' },
		{ id: 'ast', label: 'AST' },
		{ id: 'semantic', label: 'Semantic IR' },
		{ id: 'platform', label: 'Platform IR' },
		{ id: 'output', label: 'Output' },
		{ id: 'diagnostics', label: 'Diagnostics' }
	];
	const pipelineTabs = tabs.filter((tab) => ['source', 'ast', 'semantic', 'platform', 'output'].includes(tab.id));
	const primitiveCatalog = (Object.keys(primitiveManifest) as PrimitiveName[]).map((name) => ({ name, ...primitiveManifest[name] }));
	const primitiveExperiments = new Map(
		experiments
			.filter((experiment) => experiment.kind === 'primitive' && isPrimitiveName(experiment.title))
			.map((experiment) => [experiment.title as PrimitiveName, experiment] as const)
	);
	const defaultPrimitive: PrimitiveName = primitiveCatalog[0]?.name ?? 'View';
	const defaultExperiment = primitiveExperiments.get(defaultPrimitive);
	let hydrated = $state(false);
	let overlayHost: HTMLDivElement;
	let stackedInspector = $state(false);
	let navWidth = $state(defaultNavWidth);
	let inspectorWidth = $state(defaultInspectorWidth);
	let inspectorHeight = $state(defaultInspectorHeight);
	let resizeState = $state<ResizeState | null>(null);
	let highlighting = $state<WorkbenchHighlighting | null>(null);
	let selectedId = $state(defaultExperiment?.id ?? '');
	let platform = $state<R4Platform>('web');
	let inspectorTab = $state<InspectorTab>('composition');
	let platformLabel = $derived(platforms.find((item) => item.id === platform)?.label ?? platform);
	let selected = $derived(experiments.find((experiment) => experiment.id === selectedId) ?? defaultExperiment);
	let selectedPrimitive = $derived.by<PrimitiveName | null>(() => {
		const title = selected?.title;
		return title && isPrimitiveName(title) ? title : null;
	});
	let primitiveDetail = $derived(selectedPrimitive ? primitiveCatalog.find((primitive) => primitive.name === selectedPrimitive) : undefined);
	let ir = $derived(selected?.compilation.compiler.ir ?? null);
	let projection = $derived(ir ? projectPlatform(ir, platform) : null);
	let diagnostics = $derived([
		...(selected?.compilation.compiler.diagnostics ?? []),
		...(selected?.compilation.backends.lynx?.diagnostics ?? [])
	]);
	let errorCount = $derived(diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length);
	let warningCount = $derived(diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length);
	setContext('r4:embedded-page', true);
	setContext('r4:overlay-host', () => overlayHost);

	$effect(() => {
		const experiment = selected;
		let active = true;
		highlighting = null;
		experiment?.loadHighlighting().then((value) => {
			if (active) highlighting = value;
		});
		return () => {
			active = false;
		};
	});

	function clamp(value: number, minimum: number, maximum: number) {
		return Math.min(Math.max(value, minimum), maximum);
	}

	function startResize(target: ResizeTarget, event: PointerEvent & { currentTarget: HTMLElement }) {
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		resizeState = {
			target,
			startX: event.clientX,
			startY: event.clientY,
			startNavWidth: navWidth,
			startInspectorWidth: inspectorWidth,
			startInspectorHeight: inspectorHeight
		};
	}

	function resizePane(event: PointerEvent) {
		if (!resizeState) return;
		if (resizeState.target === 'navigation') {
			navWidth = clamp(resizeState.startNavWidth + event.clientX - resizeState.startX, 180, 360);
			return;
		}
		if (stackedInspector) {
			inspectorHeight = clamp(resizeState.startInspectorHeight - event.clientY + resizeState.startY, 320, 800);
			return;
		}
		inspectorWidth = clamp(resizeState.startInspectorWidth - event.clientX + resizeState.startX, 320, 640);
	}

	function stopResize(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
		resizeState = null;
	}

	function resizeWithKeyboard(target: ResizeTarget, event: KeyboardEvent) {
		const step = event.shiftKey ? 48 : 16;
		if (target === 'navigation' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
			event.preventDefault();
			navWidth = clamp(navWidth + (event.key === 'ArrowRight' ? step : -step), 180, 360);
		}
		if (target === 'inspector' && !stackedInspector && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
			event.preventDefault();
			inspectorWidth = clamp(inspectorWidth + (event.key === 'ArrowLeft' ? step : -step), 320, 640);
		}
		if (target === 'inspector' && stackedInspector && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
			event.preventDefault();
			inspectorHeight = clamp(inspectorHeight + (event.key === 'ArrowUp' ? step : -step), 320, 800);
		}
	}

	function resetPane(target: ResizeTarget) {
		if (target === 'navigation') navWidth = defaultNavWidth;
		else if (stackedInspector) inspectorHeight = defaultInspectorHeight;
		else inspectorWidth = defaultInspectorWidth;
	}

	function selectPrimitive(name: PrimitiveName) {
		const experiment = primitiveExperiments.get(name);
		if (experiment) selectedId = experiment.id;
	}

	onMount(() => {
		const stackedQuery = window.matchMedia('(max-width: 1180px)');
		const updateLayout = () => (stackedInspector = stackedQuery.matches);
		const requestedEntry = new URL(window.location.href).searchParams.get('entry');
		const requestedPrimitive = new URL(window.location.href).searchParams.get('primitive');
		if (requestedEntry && experiments.some((experiment) => experiment.id === requestedEntry)) selectedId = requestedEntry;
		else if (requestedPrimitive && isPrimitiveName(requestedPrimitive)) selectPrimitive(requestedPrimitive);
		updateLayout();
		stackedQuery.addEventListener('change', updateLayout);
		hydrated = true;
		return () => stackedQuery.removeEventListener('change', updateLayout);
	});
</script>

<svelte:head>
	<title>R4 Workbench</title>
	<meta
		name="description"
		content="The browser-first research environment for R4 semantic UI, compiler, and platform policy experiments."
	/>
</svelte:head>

<div
	class="workbench-shell"
	class:resizing={resizeState !== null}
	data-hydrated={hydrated}
	data-resize-target={resizeState?.target}
	style={`--nav-width: ${navWidth}px; --inspector-width: ${inspectorWidth}px; --inspector-height: ${inspectorHeight}px;`}
>
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

	<aside id="research-navigation" class="research-nav" aria-label="R4 primitives">
		<div class="rail-heading">
			<span>Primitive index</span>
			<small>{String(primitiveCatalog.length).padStart(2, '0')}</small>
		</div>

		<nav>
			{#each primitiveCatalog as primitive, index}
				<button
					type="button"
					class:active={selectedPrimitive === primitive.name}
					aria-current={selectedPrimitive === primitive.name ? 'page' : undefined}
					onclick={() => selectPrimitive(primitive.name)}
				>
					<span class="experiment-number">{String(index + 1).padStart(2, '0')}</span>
					<span class="experiment-copy">
						<strong>{primitive.name}</strong>
						<small>{primitive.domain}</small>
					</span>
				</button>
			{/each}
		</nav>

		<div class="rail-note">
			<span>Method</span>
			<p>Primitive / semantics / policy / decision</p>
		</div>
	</aside>
	<!-- The focusable separator pattern is defined by WAI-ARIA when aria-valuenow is present. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="pane-resizer nav-pane-resizer"
		role="separator"
		tabindex="0"
		aria-label="Resize research navigation"
		aria-controls="research-navigation workbench-stage"
		aria-orientation="vertical"
		aria-valuemin="180"
		aria-valuemax="360"
		aria-valuenow={Math.round(navWidth)}
		title="Drag or use arrow keys. Double-click to reset."
		onpointerdown={(event) => startResize('navigation', event)}
		onpointermove={resizePane}
		onpointerup={stopResize}
		onpointercancel={stopResize}
		onkeydown={(event) => resizeWithKeyboard('navigation', event)}
		ondblclick={() => resetPane('navigation')}
	></div>

	<main id="workbench-stage" class="stage">
		<section class="experiment-header">
			<div>
				<span class="eyebrow">{selectedPrimitive ? `Primitives / ${primitiveDetail?.domain}` : `${selected?.group ?? 'Experiment'} / ${selected?.id}`}</span>
				<h1>{selected?.title}</h1>
				<p>{selectedPrimitive ? `${primitiveDetail?.intent}. Web: ${primitiveDetail?.web}. Lynx: ${primitiveDetail?.lynx}.` : selected?.description}</p>
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
					<div class="preview-canvas-frame">
						<div class="preview-overlays" bind:this={overlayHost}></div>
						<div class="experiment-canvas">
							{#if selected}
								{@const Preview = selected.component}
								<Preview />
							{/if}
						</div>
					</div>
				</div>
			</div>
		</section>

		<div class="pipeline" role="group" aria-label="Compilation pipeline">
			{#each pipelineTabs as tab, index}
				<button type="button" class:active={inspectorTab === tab.id} aria-pressed={inspectorTab === tab.id} onclick={() => (inspectorTab = tab.id)}>
					<span>{String(index + 1).padStart(2, '0')}</span>
					<strong>{tab.label}</strong>
				</button>
				{#if index < pipelineTabs.length - 1}<i aria-hidden="true"></i>{/if}
			{/each}
		</div>
	</main>
	<!-- The focusable separator pattern is defined by WAI-ARIA when aria-valuenow is present. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="pane-resizer inspector-pane-resizer"
		role="separator"
		tabindex="0"
		aria-label="Resize compiler inspector"
		aria-controls="workbench-stage compiler-inspector"
		aria-orientation={stackedInspector ? 'horizontal' : 'vertical'}
		aria-valuemin="320"
		aria-valuemax={stackedInspector ? 800 : 640}
		aria-valuenow={Math.round(stackedInspector ? inspectorHeight : inspectorWidth)}
		title="Drag or use arrow keys. Double-click to reset."
		onpointerdown={(event) => startResize('inspector', event)}
		onpointermove={resizePane}
		onpointerup={stopResize}
		onpointercancel={stopResize}
		onkeydown={(event) => resizeWithKeyboard('inspector', event)}
		ondblclick={() => resetPane('inspector')}
	></div>

	<aside id="compiler-inspector" class="inspector" aria-label="Compiler inspector">
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
				{#if highlighting}<HighlightedCode code={highlighting.source} label="Highlighted experiment source" />{:else}<div class="code-loading">Highlighting source...</div>{/if}
			{:else if inspectorTab === 'composition'}
				<CompositionTree {ir} />
			{:else if inspectorTab === 'ast'}
				{#if highlighting}<HighlightedCode code={highlighting.ast} label="Highlighted Svelte AST" />{:else}<div class="code-loading">Highlighting AST...</div>{/if}
			{:else if inspectorTab === 'semantic'}
				{#if highlighting}<HighlightedCode code={highlighting.semantic} label="Highlighted Semantic IR" />{:else}<div class="code-loading">Highlighting Semantic IR...</div>{/if}
			{:else if inspectorTab === 'platform'}
				<div class="inspector-summary">
					<span>{projection?.mode}</span>
					<strong>{projection?.renderer}</strong>
				</div>
				{#if highlighting}<HighlightedCode code={highlighting.platforms[platform]} label="Highlighted Platform IR" />{:else}<div class="code-loading">Highlighting Platform IR...</div>{/if}
			{:else if inspectorTab === 'output'}
				{#if platform === 'web'}
					<div class="output-note">
						<strong>Direct Svelte web lowering</strong>
						<p>The rendered preview is the output. SvelteKit owns server rendering, HTML, CSS, hydration, and client updates.</p>
					</div>
					{#if highlighting}<HighlightedCode code={highlighting.platforms.web} label="Highlighted web output policy" />{:else}<div class="code-loading">Highlighting web output...</div>{/if}
				{:else}
					<div class="output-note experimental">
						<strong>Lynx backend experiment</strong>
						<p>Generated ReactLynx is below the backend boundary and is not part of the R4 authoring API.</p>
					</div>
					{#if highlighting}<HighlightedCode code={highlighting.lynx} label="Highlighted Lynx TSX output" />{:else}<div class="code-loading">Highlighting Lynx output...</div>{/if}
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
