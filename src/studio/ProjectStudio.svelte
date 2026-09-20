<script lang="ts">
	import { base } from '$app/paths';
	import { onMount, setContext } from 'svelte';
	import { lowerToLynx } from '../lib/backends/lynx.js';
	import type { R4Node, R4Platform } from '../lib/compiler/index.js';
	import { projectPlatform, type PlatformPolicyNode } from '../lib/policy.js';
	import CompositionTree from '../workbench/CompositionTree.svelte';
	import { R4_STUDIO_PROJECT_COMPILER_PROFILE } from './compiler-profile.js';
	import type { R4StudioAppliedTransaction, R4StudioSourceTransaction } from './contracts.js';
	import {
		completeStudioRedo,
		completeStudioUndo,
		createStudioHistory,
		invalidateStudioHistory,
		recordStudioEdit
	} from './history.js';
	import type { R4StudioSetPropertyIntent } from './inspector.js';
	import { createStudioProjectClient, type R4StudioProjectClient } from './project-client.js';
	import type { R4StudioProjectConnection, R4StudioDocumentFreshness, R4StudioProjectResponse, R4StudioProjectChange } from './project-protocol.js';
	import { createStudioNodeRef, findStudioNodeAtOffset, resolveStudioNode } from './selection.js';
	import { createStudioSnapshot } from './snapshot.js';
	import StudioPropertiesInspector from './StudioPropertiesInspector.svelte';
	import StudioSourceView from './StudioSourceView.svelte';
	import {
		groupStudioProjectDocuments,
		studioProjectDocument,
		studioProjectDocuments,
		studioProjectDocumentsFromService,
		type R4StudioProjectDocument
	} from './project.js';
	import type { R4StudioNodeRef, R4StudioSnapshot } from './types.js';

	type InspectorView = 'composition' | 'properties' | 'source' | 'semantic' | 'platform' | 'diagnostics';

	const platforms: Array<{ id: R4Platform; label: string }> = [
		{ id: 'web', label: 'Web' },
		{ id: 'ios', label: 'iOS' },
		{ id: 'android', label: 'Android' },
		{ id: 'macos', label: 'macOS' },
		{ id: 'windows', label: 'Windows' }
	];
	const inspectorViews: Array<{ id: InspectorView; label: string }> = [
		{ id: 'composition', label: 'Composition' },
		{ id: 'properties', label: 'Properties' },
		{ id: 'source', label: 'Source' },
		{ id: 'semantic', label: 'Semantic IR' },
		{ id: 'platform', label: 'Platform IR' },
		{ id: 'diagnostics', label: 'Diagnostics' }
	];
	const staticDefaultDocument = studioProjectDocuments.find((document) => document.id === 'field-operations') ?? studioProjectDocuments[0];
	const initialDocumentId = staticDefaultDocument?.id ?? '';

	let documents = $state<R4StudioProjectDocument[]>([...studioProjectDocuments]);
	let selectedId = $state(initialDocumentId);
	let requestedDocumentId = $state(initialDocumentId);
	let platform = $state<R4Platform>('web');
	let inspectorView = $state<InspectorView>('composition');
	let search = $state('');
	let snapshot = $state<R4StudioSnapshot | null>(null);
	let selectedRef = $state<R4StudioNodeRef | null>(null);
	let connection = $state<R4StudioProjectConnection>({ status: 'static' });
	let freshness = $state<R4StudioDocumentFreshness>('loading');
	let projectMessage = $state('Loading the selected project source.');
	let mutationMessage = $state('');
	let mutationPending = $state(false);
	let pendingTransactionId = $state<string | null>(null);
	let history = $state(createStudioHistory());
	let tombstone = $state<R4StudioProjectDocument | null>(null);
	let hydrated = $state(false);
	let overlayHost: HTMLDivElement;
	let projectClient: R4StudioProjectClient | null = null;
	let loadRequest = 0;
	let lastLoadKey = '';
	let defaultDocument = $derived(documents.find((document) => document.id === 'field-operations') ?? documents[0]);
	let selected = $derived(studioProjectDocument(selectedId, documents) ?? (tombstone?.id === selectedId ? tombstone : defaultDocument));
	let ir = $derived(snapshot?.compilation.ir ?? null);
	let projection = $derived(ir ? projectPlatform(ir, platform) : null);
	let selectedNode = $derived(snapshot && selectedRef ? resolveStudioNode(snapshot, selectedRef) : null);
	let selectedPlatformNode = $derived(selectedRef && projection ? findPlatformNode(projection.nodes, selectedRef.target.id) : null);
	let backendDiagnostics = $derived.by(() => {
		if ((platform !== 'ios' && platform !== 'android') || !ir) return [];
		if (snapshot?.compilation.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) return [];
		return lowerToLynx(ir).diagnostics;
	});
	let diagnostics = $derived([...(snapshot?.compilation.diagnostics ?? []), ...backendDiagnostics]);
	let errorCount = $derived(diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length);
	let warningCount = $derived(diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length);
	let preview = $derived(
		selected?.preview && (connection.status === 'static' || (connection.status === 'connected' && connection.workspace.preview === 'repository'))
			? selected.preview
			: null
	);
	let editingEnabled = $derived(
		connection.status === 'connected' &&
		connection.workspace.capabilities.write &&
		freshness === 'current' &&
		Boolean(selected?.serviceId && snapshot && selectedRef)
	);
	let normalizedSearch = $derived(search.trim().toLowerCase());
	let visibleGroups = $derived(
		groupStudioProjectDocuments(documents)
			.map((group) => ({
				...group,
				documents: normalizedSearch
					? group.documents.filter((document) => `${document.title} ${document.path}`.toLowerCase().includes(normalizedSearch))
					: group.documents
			}))
			.filter((group) => group.documents.length > 0)
	);

	setContext('r4:embedded-page', true);
	setContext('r4:overlay-host', () => overlayHost);

	$effect(() => {
		const document = selected;
		if (!document) return;
		const mode = connection.status === 'connected' && document.serviceId ? `service:${connection.sessionId}` : 'static';
		const key = `${mode}:${document.serviceId ?? document.id}:${document.revision ?? document.preview?.source.length ?? 0}`;
		if (key === lastLoadKey || (freshness === 'deleted' && tombstone?.id === document.id)) return;
		lastLoadKey = key;
		void loadDocument(document);
	});

	onMount(() => {
		const selectFromLocation = () => {
			const requested = new URL(window.location.href).searchParams.get('document');
			requestedDocumentId = requested || defaultDocument?.id || '';
			selectedId = studioProjectDocument(requestedDocumentId, documents)?.id || defaultDocument?.id || '';
		};
		selectFromLocation();
		window.addEventListener('popstate', selectFromLocation);
		projectClient = createStudioProjectClient({
			onConnection(nextConnection) {
				connection = nextConnection;
				if (nextConnection.status === 'disconnected') {
					freshness = 'unknown';
					projectMessage = nextConnection.message;
					history = invalidateStudioHistory();
				}
				if (nextConnection.status === 'failed') {
					freshness = 'failed';
					projectMessage = nextConnection.message;
					history = invalidateStudioHistory();
				}
			},
			onManifest(manifest) {
				adoptManifest(manifest);
			}
		});
		if (projectClient) void projectClient.connect().catch(() => undefined);
		hydrated = true;
		return () => {
			window.removeEventListener('popstate', selectFromLocation);
			projectClient?.dispose();
		};
	});

	async function loadDocument(document: R4StudioProjectDocument) {
		const request = ++loadRequest;
		freshness = snapshot ? 'refreshing' : 'loading';
		projectMessage = freshness === 'refreshing' ? 'Refreshing the revision-qualified project snapshot.' : 'Loading the selected project source.';
		selectedRef = null;
		try {
			let nextSnapshot: R4StudioSnapshot;
			if (connection.status === 'connected' && document.serviceId && projectClient) {
				let response = await projectClient.read(document.serviceId, document.revision);
				if (response.type === 'stale') response = await projectClient.read(document.serviceId, response.current.revision);
				if (response.type !== 'snapshot') throw new Error('The project source changed repeatedly while Studio read it.');
				nextSnapshot = response.snapshot;
			} else if (document.preview) {
				nextSnapshot = await createStudioSnapshot(
					document.preview.source,
					document.path,
					document.preview.compilation.compiler,
					R4_STUDIO_PROJECT_COMPILER_PROFILE
				);
			} else {
				throw new Error('This project document requires the local Studio service.');
			}
			if (request !== loadRequest) return;
			snapshot = nextSnapshot;
			freshness = 'current';
			projectMessage = 'The source snapshot matches the local project service.';
			const firstNode = nextSnapshot.compilation.ir?.root[0];
			if (firstNode) selectedRef = createStudioNodeRef(nextSnapshot, firstNode.id);
		} catch (error) {
			if (request !== loadRequest) return;
			freshness = connection.status === 'disconnected' ? 'unknown' : 'failed';
			projectMessage = error instanceof Error ? error.message : 'The project source could not be loaded.';
		}
	}

	function adoptManifest(manifest: Extract<R4StudioProjectResponse, { type: 'connected' }> | R4StudioProjectChange) {
		const previous = selected;
		const allowPreview = 'workspace' in manifest
			? manifest.workspace.preview === 'repository'
			: connection.status === 'connected' && connection.workspace.preview === 'repository';
		const nextDocuments = studioProjectDocumentsFromService(manifest.documents, allowPreview);
		const requested = studioProjectDocument(requestedDocumentId, nextDocuments);
		const current = studioProjectDocument(selectedId, nextDocuments);
		const nextSelected = requested ?? current;
		const localTransaction = 'cause' in manifest && manifest.cause?.transactionId === pendingTransactionId;
		if (snapshot && nextSelected?.revision && nextSelected.revision !== snapshot.document.revision && !localTransaction) {
			history = invalidateStudioHistory();
			mutationMessage = 'Undo history was cleared because the source changed outside Studio.';
		}
		documents = nextDocuments;
		if (requested) {
			selectedId = requested.id;
			tombstone = null;
		} else if (current) {
			selectedId = current.id;
			tombstone = null;
		} else if (previous?.serviceId) {
			tombstone = previous;
			freshness = 'deleted';
			projectMessage = 'The selected project document was deleted outside Studio.';
		} else {
			selectedId = nextDocuments[0]?.id ?? '';
		}
		if (connection.status === 'connected') connection = { ...connection, sequence: manifest.sequence };
		const active = studioProjectDocument(selectedId, nextDocuments);
		lastLoadKey = snapshot && active?.revision === snapshot.document.revision
			? `service:${connection.status === 'connected' ? connection.sessionId : ''}:${active.serviceId ?? active.id}:${active.revision}`
			: '';
	}

	function selectDocument(document: R4StudioProjectDocument, updateHistory = true) {
		selectedId = document.id;
		requestedDocumentId = document.id;
		tombstone = null;
		lastLoadKey = '';
		history = invalidateStudioHistory();
		mutationMessage = '';
		if (!updateHistory || typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		url.searchParams.set('document', document.id);
		window.history.pushState({}, '', url);
	}

	function selectNode(node: R4Node) {
		if (!snapshot) return;
		selectedRef = createStudioNodeRef(snapshot, node.id);
	}

	async function commitProperty(intent: R4StudioSetPropertyIntent) {
		if (!projectClient || !selected?.serviceId || mutationPending) return;
		mutationPending = true;
		pendingTransactionId = intent.id;
		mutationMessage = '';
		try {
			const response = await projectClient.setProperty(selected.serviceId, intent);
			if (response.type === 'mutation' && response.status === 'applied') {
				adoptAppliedTransaction(response.applied);
				history = recordStudioEdit(history, response.applied.undo);
				mutationMessage = `${response.applied.undo.label.replace(/^Undo /, '')} applied.`;
			} else if (response.type === 'mutation') {
				mutationMessage = 'The property already has that value.';
			} else if (response.type === 'conflict') {
				adoptConflict(response.current);
			} else {
				mutationMessage = response.reason;
			}
		} catch (error) {
			mutationMessage = error instanceof Error ? error.message : 'The property edit failed.';
		} finally {
			mutationPending = false;
			pendingTransactionId = null;
		}
	}

	async function undo() {
		const transaction = history.undo.at(-1);
		if (!transaction) return;
		const applied = await applyHistoryTransaction(transaction);
		if (applied) history = completeStudioUndo(history, applied.undo);
	}

	async function redo() {
		const transaction = history.redo.at(-1);
		if (!transaction) return;
		const applied = await applyHistoryTransaction(transaction);
		if (applied) history = completeStudioRedo(history, applied.undo);
	}

	async function applyHistoryTransaction(transaction: R4StudioSourceTransaction): Promise<R4StudioAppliedTransaction | null> {
		if (!projectClient || !selected?.serviceId || mutationPending) return null;
		mutationPending = true;
		pendingTransactionId = transaction.id;
		mutationMessage = '';
		try {
			const response = await projectClient.applyTransaction(selected.serviceId, transaction);
			if (response.type === 'mutation' && response.status === 'applied') {
				adoptAppliedTransaction(response.applied);
				mutationMessage = `${transaction.label} applied.`;
				return response.applied;
			}
			if (response.type === 'conflict') adoptConflict(response.current);
			else mutationMessage = response.type === 'rejected' ? response.reason : 'The source already matches this history entry.';
			return null;
		} catch (error) {
			mutationMessage = error instanceof Error ? error.message : 'The history transaction failed.';
			return null;
		} finally {
			mutationPending = false;
			pendingTransactionId = null;
		}
	}

	function adoptAppliedTransaction(applied: R4StudioAppliedTransaction) {
		const previousNode = selectedNode;
		snapshot = applied.snapshot;
		freshness = 'current';
		projectMessage = 'The Studio transaction matches the local project source.';
		const nextNode = previousNode
			? findStudioNodeAtOffset(applied.snapshot, Math.min(previousNode.range.start.offset + 1, applied.snapshot.source.length))
			: applied.snapshot.compilation.ir?.root[0] ?? null;
		selectedRef = nextNode ? createStudioNodeRef(applied.snapshot, nextNode.id) : null;
		if (selected?.serviceId && connection.status === 'connected') {
			lastLoadKey = `service:${connection.sessionId}:${selected.serviceId}:${applied.snapshot.document.revision}`;
			documents = documents.map((document) =>
				document.serviceId === selected?.serviceId ? { ...document, revision: applied.snapshot.document.revision } : document
			);
		}
	}

	function adoptConflict(current: R4StudioSnapshot) {
		snapshot = current;
		freshness = 'current';
		history = invalidateStudioHistory();
		mutationMessage = 'The edit was rejected because the source changed outside Studio. The current source was reloaded.';
		const firstNode = current.compilation.ir?.root[0];
		selectedRef = firstNode ? createStudioNodeRef(current, firstNode.id) : null;
		if (selected?.serviceId && connection.status === 'connected') {
			lastLoadKey = `service:${connection.sessionId}:${selected.serviceId}:${current.document.revision}`;
			documents = documents.map((document) =>
				document.serviceId === selected?.serviceId ? { ...document, revision: current.document.revision } : document
			);
		}
	}

	function findPlatformNode(nodes: PlatformPolicyNode[], id: string): PlatformPolicyNode | null {
		for (const node of nodes) {
			if (node.id === id) return node;
			const child = findPlatformNode(node.children, id);
			if (child) return child;
		}
		return null;
	}

	function nodeLabel(node: R4Node | null) {
		if (!node) return 'Document';
		if (node.kind === 'element') return node.primitive;
		if (node.kind === 'component') return node.name;
		if (node.kind === 'text') return 'Text content';
		if (node.kind === 'if') return 'Conditional';
		return 'Collection';
	}

	function connectionLabel() {
		if (connection.status === 'connected') return 'Local service connected';
		if (connection.status === 'connecting') return 'Connecting local service';
		if (connection.status === 'disconnected') return 'Local service disconnected';
		if (connection.status === 'failed') return 'Local service failed';
		return 'Static project snapshot';
	}
</script>

<div class="project-studio" data-hydrated={hydrated}>
	<header class="studio-header">
		<a class="brand" href={`${base}/studio/`} aria-label="R4 Studio home">
			<span class="brand-mark" aria-hidden="true">R4</span>
			<span><strong>Studio</strong><small>local project environment</small></span>
		</a>
		<div class="project-identity">
			<span>Project</span>
			<strong>{connection.status === 'connected' ? connection.workspace.name : 'R4 framework repository'}</strong>
			<small>{documents.length} analyzed documents / {connectionLabel()}</small>
		</div>
		<div class="platform-switcher" role="group" aria-label="Target platform">
			{#each platforms as item}
				<button type="button" class:active={platform === item.id} aria-pressed={platform === item.id} onclick={() => (platform = item.id)}>{item.label}</button>
			{/each}
		</div>
		<nav aria-label="R4 development environments">
			<a href={`${base}/studio/scratch/`}>Scratch</a>
			<a href={`${base}/`}>Workbench</a>
		</nav>
	</header>

	<aside class="project-navigation" aria-label="Project documents">
		<div class="navigator-heading">
			<div><span>Project</span><strong>Application sources</strong></div>
			<small>{String(documents.length).padStart(2, '0')}</small>
		</div>
		<label class="project-search">
			<span>Filter project documents</span>
			<input type="search" bind:value={search} placeholder="Filter files" />
		</label>
		<div class="document-groups">
			{#each visibleGroups as group}
				<section aria-labelledby={`group-${group.kind}`}>
					<header><strong id={`group-${group.kind}`}>{group.label}</strong><span>{group.documents.length}</span></header>
					<div class="document-list">
						{#each group.documents as document}
							<button
								type="button"
								class:active={selected?.id === document.id}
								aria-current={selected?.id === document.id ? 'page' : undefined}
								onclick={() => selectDocument(document)}
							>
								<strong>{document.title}</strong>
								<span>{document.path.replace('research/', '')}</span>
							</button>
						{/each}
					</div>
				</section>
			{/each}
			{#if visibleGroups.length === 0}<p class="no-results">No project documents match “{search}”.</p>{/if}
		</div>
	</aside>

	<main class="project-stage">
		<header class="document-header">
			<div>
				<span>{selected?.kind} / {selected?.group}</span>
				<h1>{selected?.title}</h1>
				<p>{selected?.description}</p>
			</div>
			<div class="document-state" data-freshness={freshness} aria-live="polite">
				<code>{selected?.path}</code>
				<strong>{connectionLabel()}</strong>
				<small>{projectMessage}</small>
			</div>
		</header>

		<section class="runtime-section" aria-label="Application runtime">
			<header class="runtime-toolbar">
				<div class="runtime-state" data-mode={platform === 'web' && preview ? 'actual' : 'simulated'}>
					<span aria-hidden="true"></span>
					<div>
						<strong>{platform === 'web' ? (preview ? 'Actual Svelte web runtime' : 'Analysis-only project source') : `Simulated ${platforms.find((item) => item.id === platform)?.label} policy`}</strong>
						<small>{platform === 'web' ? (preview ? 'SSR + hydration / trusted repository module' : 'Source is analyzed but never executed in the Studio origin') : 'Browser approximation / not native execution'}</small>
					</div>
				</div>
				<div class="runtime-diagnostics" class:has-errors={errorCount > 0} class:has-warnings={errorCount === 0 && warningCount > 0}>
					<strong>{errorCount}</strong><span>errors</span><strong>{warningCount}</strong><span>warnings</span>
				</div>
			</header>
			<div class="runtime-field" data-platform={platform}>
				<div class="runtime-frame" data-r4-platform={platform}>
					<div class="runtime-chrome">
						<span></span><span></span><span></span>
						<small>{platform === 'web' ? 'project://web' : `project://${platform}/simulation`}</small>
					</div>
					<div class="runtime-canvas-frame">
						<div class="runtime-overlays" bind:this={overlayHost}></div>
						<div class="runtime-canvas">
						{#if preview}
							{#key preview.id}
								{@const Preview = preview.component}
								<Preview />
							{/key}
						{:else}
							<div class="analysis-only"><strong>Execution withheld</strong><span>Connect an isolated project runtime before executing this workspace source.</span></div>
						{/if}
						</div>
					</div>
				</div>
			</div>
		</section>
	</main>

	<aside class="project-inspector" aria-label="Project inspector">
		<header class="inspector-heading">
			<div><span>Inspector</span><strong>{nodeLabel(selectedNode)}</strong></div>
			<div class="inspector-actions">
				<button type="button" onclick={undo} disabled={!editingEnabled || mutationPending || history.undo.length === 0}>Undo</button>
				<button type="button" onclick={redo} disabled={!editingEnabled || mutationPending || history.redo.length === 0}>Redo</button>
				<code>{selectedNode ? `#${selectedNode.id}` : snapshot?.document.revision.slice(0, 10) ?? '--'}</code>
			</div>
		</header>
		<div class="inspector-tabs" role="tablist" aria-label="Project inspector view">
			{#each inspectorViews as view}
				<button
					type="button"
					role="tab"
					aria-selected={inspectorView === view.id}
					class:active={inspectorView === view.id}
					onclick={() => (inspectorView = view.id)}
				>{view.label}{#if view.id === 'diagnostics'}<span>{diagnostics.length}</span>{/if}</button>
			{/each}
		</div>
		<div class="inspector-content" role="tabpanel">
			{#if mutationMessage}<div class="mutation-message" aria-live="polite">{mutationMessage}</div>{/if}
			{#if inspectorView === 'composition'}
				<CompositionTree {ir} selectedNodeId={selectedNode?.id} onselect={selectNode} />
			{:else if inspectorView === 'properties'}
				{#if snapshot && selectedRef}
					<StudioPropertiesInspector {snapshot} {selectedRef} disabled={!editingEnabled || mutationPending} oncommit={commitProperty} />
				{:else}
					<div class="inspector-empty"><strong>No selection</strong><span>Select a semantic primitive before editing properties.</span></div>
				{/if}
			{:else if inspectorView === 'source'}
				<StudioSourceView source={snapshot?.source ?? ''} range={selectedNode?.range} label="Selected project source" />
			{:else if inspectorView === 'semantic'}
				<pre aria-label="Selected Semantic IR">{JSON.stringify(selectedNode ?? ir, null, 2)}</pre>
			{:else if inspectorView === 'platform'}
				<div class="projection-summary"><span>{projection?.mode}</span><strong>{projection?.renderer}</strong></div>
				<pre aria-label="Selected Platform IR">{JSON.stringify(selectedPlatformNode ?? projection, null, 2)}</pre>
			{:else}
				{#if platform === 'ios' || platform === 'android'}
					<div class="projection-summary"><span>Lynx prototype backend</span><strong>simulated</strong></div>
				{:else if platform !== 'web'}
					<div class="projection-summary"><span>No renderer backend connected</span><strong>simulated</strong></div>
				{/if}
				{#if diagnostics.length === 0}
					<div class="inspector-empty"><strong>No diagnostics</strong><span>This document is inside the selected platform policy.</span></div>
				{:else}
					<ul class="diagnostic-list">
						{#each diagnostics as diagnostic}
							<li data-severity={diagnostic.severity}><div><strong>{diagnostic.code}</strong><span>{diagnostic.severity}</span></div><p>{diagnostic.message}</p></li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	</aside>
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
	:global(input) {
		font: inherit;
	}

	:global(a:focus-visible),
	:global(button:focus-visible),
	:global(input:focus-visible) {
		position: relative;
		z-index: 5;
		outline: 3px solid #005bd7;
		outline-offset: -3px;
	}

	.project-studio {
		display: grid;
		grid-template:
			'header header header' 64px
			'navigation stage inspector' minmax(0, calc(100svh - 64px)) /
			248px minmax(420px, 1fr) 450px;
		min-height: 100svh;
		background: #d7d5ce;
	}

	.studio-header {
		display: grid;
		grid-area: header;
		grid-template-columns: 248px minmax(220px, 1fr) auto auto;
		border-bottom: 1px solid #8f908b;
		background: #eceae3;
	}

	.brand,
	.project-identity,
	.studio-header nav,
	.platform-switcher {
		display: flex;
		align-items: center;
	}

	.brand {
		gap: 10px;
		border-right: 1px solid #b8b5ad;
		padding: 9px 14px;
		color: inherit;
		text-decoration: none;
	}

	.brand-mark {
		display: grid;
		width: 36px;
		height: 36px;
		place-items: center;
		background: #171b1e;
		color: #fffdf6;
		font: 700 0.75rem/1 var(--r4-font-mono);
	}

	.brand > span:last-child,
	.project-identity {
		display: grid;
		gap: 3px;
	}

	.brand strong,
	.project-identity strong {
		font-size: 0.8rem;
	}

	.brand small,
	.project-identity span,
	.project-identity small {
		color: #697074;
		font: 0.53rem/1 var(--r4-font-mono);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.project-identity {
		align-content: center;
		padding: 8px 16px;
	}

	.platform-switcher {
		border-left: 1px solid #b8b5ad;
	}

	.platform-switcher button,
	.studio-header nav a {
		display: grid;
		height: 100%;
		place-items: center;
		border: 0;
		border-right: 1px solid #b8b5ad;
		background: transparent;
		padding: 0 12px;
		color: #62696c;
		font: 0.57rem/1 var(--r4-font-mono);
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}

	.platform-switcher button.active {
		background: #171b1e;
		color: white;
	}

	.studio-header nav a {
		color: #005bd7;
	}

	.project-navigation {
		display: grid;
		grid-area: navigation;
		grid-template-rows: auto auto minmax(0, 1fr);
		min-width: 0;
		border-right: 1px solid #8f908b;
		background: #dfddd6;
	}

	.navigator-heading,
	.inspector-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 70px;
		border-bottom: 1px solid #b8b5ad;
		padding: 12px 14px;
	}

	.navigator-heading > div,
	.inspector-heading > div {
		display: grid;
		gap: 5px;
	}

	.navigator-heading span,
	.inspector-heading span {
		color: #71777a;
		font: 0.52rem/1 var(--r4-font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.navigator-heading strong,
	.inspector-heading strong {
		font-size: 0.72rem;
	}

	.navigator-heading small,
	.inspector-heading code {
		color: #7b8183;
		font: 0.58rem/1 var(--r4-font-mono);
	}

	.project-search {
		display: block;
		border-bottom: 1px solid #b8b5ad;
		padding: 10px;
	}

	.project-search span {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.project-search input {
		width: 100%;
		border: 1px solid #aaa9a3;
		border-radius: 0;
		background: #f4f1e9;
		padding: 8px 9px;
		font: 0.65rem/1 var(--r4-font-mono);
	}

	.document-groups {
		overflow-y: auto;
	}

	.document-groups section > header {
		display: flex;
		justify-content: space-between;
		position: sticky;
		top: 0;
		z-index: 1;
		border-bottom: 1px solid #b8b5ad;
		background: #c8c6bf;
		padding: 7px 10px;
		color: #5f6669;
		font: 0.53rem/1 var(--r4-font-mono);
		text-transform: uppercase;
	}

	.document-list {
		display: grid;
	}

	.document-list button {
		display: grid;
		gap: 5px;
		border: 0;
		border-bottom: 1px solid #c2c0b9;
		background: transparent;
		padding: 11px 12px;
		text-align: left;
		cursor: pointer;
	}

	.document-list button:hover {
		background: rgb(255 255 255 / 30%);
	}

	.document-list button.active {
		background: #fffdf6;
		box-shadow: inset 3px 0 #005bd7;
	}

	.document-list strong {
		overflow: hidden;
		font-size: 0.68rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.document-list span {
		overflow: hidden;
		color: #777d80;
		font: 0.52rem/1 var(--r4-font-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.no-results {
		padding: 18px;
		color: #747b7e;
		font: 0.65rem/1.5 var(--r4-font-mono);
	}

	.project-stage {
		grid-area: stage;
		min-width: 0;
		overflow-y: auto;
		background:
			linear-gradient(90deg, rgb(75 77 76 / 8%) 1px, transparent 1px),
			linear-gradient(rgb(75 77 76 / 8%) 1px, transparent 1px),
			#d7d5ce;
		background-size: 24px 24px;
	}

	.document-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 30px;
		border-bottom: 1px solid #9f9e98;
		background: rgb(236 234 227 / 94%);
		padding: 22px 24px;
	}

	.document-header span {
		color: #005bd7;
		font: 0.57rem/1 var(--r4-font-mono);
		text-transform: uppercase;
	}

	.document-header h1 {
		margin: 7px 0 0;
		font: 650 1.35rem/1.1 var(--r4-font-sans);
	}

	.document-header p {
		max-width: 660px;
		margin: 8px 0 0;
		color: #60676a;
		font-size: 0.78rem;
		line-height: 1.45;
	}

	.document-header code {
		max-width: 100%;
		overflow: hidden;
		color: #737a7c;
		font: 0.56rem/1.4 var(--r4-font-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.document-state {
		display: grid;
		justify-items: end;
		max-width: 45%;
		gap: 5px;
		text-align: right;
	}

	.document-state strong {
		font-size: 0.65rem;
	}

	.document-state small {
		color: #747b7d;
		font: 0.52rem/1.35 var(--r4-font-mono);
	}

	.document-state[data-freshness='current'] strong {
		color: #18864f;
	}

	.document-state[data-freshness='deleted'] strong,
	.document-state[data-freshness='failed'] strong,
	.document-state[data-freshness='stale'] strong {
		color: #b42318;
	}

	.runtime-section {
		margin: 22px;
		border: 1px solid #93938d;
		background: #bfc0ba;
		box-shadow: 0 18px 55px rgb(35 38 38 / 15%);
	}

	.runtime-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		min-height: 56px;
		border-bottom: 1px solid #93938d;
		background: #eceae3;
		padding: 9px 12px;
	}

	.runtime-state,
	.runtime-state > div,
	.runtime-diagnostics {
		display: flex;
		align-items: center;
	}

	.runtime-state {
		gap: 10px;
	}

	.runtime-state > span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #35a66a;
		box-shadow: 0 0 0 4px rgb(53 166 106 / 12%);
	}

	.runtime-state[data-mode='simulated'] > span {
		background: #d39222;
		box-shadow: 0 0 0 4px rgb(211 146 34 / 12%);
	}

	.runtime-state > div {
		align-items: flex-start;
		flex-direction: column;
		gap: 4px;
	}

	.runtime-state strong {
		font-size: 0.67rem;
	}

	.runtime-state small,
	.runtime-diagnostics {
		color: #747b7d;
		font: 0.52rem/1 var(--r4-font-mono);
	}

	.runtime-diagnostics {
		gap: 5px;
	}

	.runtime-diagnostics strong {
		color: #18864f;
	}

	.runtime-diagnostics.has-errors strong:first-child {
		color: #b42318;
	}

	.runtime-diagnostics.has-warnings strong:nth-of-type(2) {
		color: #9b650a;
	}

	.runtime-field {
		display: grid;
		min-height: 620px;
		place-items: start center;
		padding: 26px;
	}

	.runtime-frame {
		width: min(100%, 920px);
		border: 1px solid #777b7b;
		background: #f8f8f5;
		box-shadow: 0 22px 50px rgb(38 42 42 / 22%);
	}

	.runtime-field[data-platform='ios'] .runtime-frame,
	.runtime-field[data-platform='android'] .runtime-frame {
		width: min(100%, 390px);
		border-radius: 22px;
		overflow: hidden;
	}

	.runtime-chrome {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 34px;
		border-bottom: 1px solid #c5c6c1;
		background: #e4e5e1;
		padding: 0 10px;
	}

	.runtime-chrome > span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #a8aaa6;
	}

	.runtime-chrome small {
		margin-left: 6px;
		color: #72787a;
		font: 0.5rem/1 var(--r4-font-mono);
	}

	.runtime-canvas-frame {
		position: relative;
		height: 620px;
		overflow: hidden;
		background: #fff;
	}

	.runtime-canvas,
	.runtime-overlays {
		position: absolute;
		inset: 0;
	}

	.runtime-canvas {
		overflow: auto;
	}

	.analysis-only {
		display: grid;
		min-height: 420px;
		align-content: center;
		justify-items: center;
		gap: 8px;
		padding: 30px;
		color: #596165;
		text-align: center;
	}

	.analysis-only strong {
		color: #1d2326;
		font-size: 0.85rem;
	}

	.analysis-only span {
		max-width: 380px;
		font: 0.63rem/1.5 var(--r4-font-mono);
	}

	.runtime-overlays {
		z-index: 20;
		pointer-events: none;
	}

	.project-inspector {
		display: grid;
		grid-area: inspector;
		grid-template-rows: auto auto minmax(0, 1fr);
		min-width: 0;
		border-left: 1px solid #111719;
		background: #202528;
		color: #e8e9e7;
	}

	.inspector-heading {
		border-color: #3a4145;
		background: #292f33;
	}

	.inspector-heading span,
	.inspector-heading code {
		color: #849095;
	}

	.inspector-heading > .inspector-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.inspector-actions button {
		border: 1px solid #4b555a;
		background: #1d2326;
		padding: 5px 7px;
		color: #cad3d5;
		font: 0.52rem/1 var(--r4-font-mono);
		cursor: pointer;
	}

	.inspector-actions button:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	.mutation-message {
		border-bottom: 1px solid #3a4145;
		background: #182226;
		padding: 9px 12px;
		color: #a9c7d5;
		font: 0.56rem/1.45 var(--r4-font-mono);
	}

	.inspector-tabs {
		display: flex;
		overflow-x: auto;
		border-bottom: 1px solid #3a4145;
	}

	.inspector-tabs button {
		display: flex;
		align-items: center;
		gap: 6px;
		border: 0;
		border-right: 1px solid #3a4145;
		background: transparent;
		padding: 10px 11px;
		color: #919b9f;
		font: 0.55rem/1 var(--r4-font-mono);
		white-space: nowrap;
		cursor: pointer;
	}

	.inspector-tabs button.active {
		background: #30373a;
		color: #fff;
		box-shadow: inset 0 -2px #70b3f2;
	}

	.inspector-tabs button span {
		color: #f2c45e;
	}

	.inspector-content {
		min-height: 0;
		overflow: auto;
	}

	.inspector-content > pre {
		min-height: 100%;
		margin: 0;
		padding: 18px;
		color: #d7e1df;
		font: 0.66rem/1.55 var(--r4-font-mono);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.projection-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #3a4145;
		padding: 11px 13px;
		font: 0.56rem/1 var(--r4-font-mono);
	}

	.projection-summary span {
		color: #f2c45e;
		text-transform: uppercase;
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
		padding: 14px;
		box-shadow: inset 3px 0 #879196;
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
		font: 0.57rem/1 var(--r4-font-mono);
	}

	.diagnostic-list li span {
		color: #8d989d;
		text-transform: uppercase;
	}

	.diagnostic-list p {
		margin: 8px 0 0;
		color: #d0d7d5;
		font-size: 0.7rem;
		line-height: 1.45;
	}

	.inspector-empty {
		display: grid;
		min-height: 300px;
		place-content: center;
		justify-items: center;
		gap: 7px;
		padding: 24px;
		text-align: center;
	}

	.inspector-empty strong {
		font-size: 0.72rem;
	}

	.inspector-empty span {
		max-width: 280px;
		color: #869095;
		font: 0.62rem/1.5 var(--r4-font-mono);
	}

	@media (max-width: 1180px) {
		.project-studio {
			grid-template:
				'header header' auto
				'navigation stage' minmax(700px, auto)
				'inspector inspector' minmax(560px, auto) /
				220px minmax(0, 1fr);
		}

		.studio-header {
			grid-template-columns: 220px 1fr auto;
			min-height: 64px;
		}

		.project-identity {
			display: none;
		}

		.project-inspector {
			border-top: 1px solid #111719;
			border-left: 0;
		}
	}

	@media (max-width: 720px) {
		.project-studio {
			display: block;
		}

		.studio-header {
			display: flex;
			min-height: 0;
			flex-wrap: wrap;
		}

		.brand {
			min-height: 58px;
			border-right: 0;
		}

		.brand small {
			display: none;
		}

		.studio-header nav {
			margin-left: auto;
		}

		.studio-header nav a {
			height: 58px;
		}

		.platform-switcher {
			order: 3;
			width: 100%;
			height: 42px;
			overflow-x: auto;
			border-top: 1px solid #b8b5ad;
			border-left: 0;
		}

		.platform-switcher button {
			min-width: 68px;
			flex: 1;
		}

		.project-navigation {
			display: block;
			border-right: 0;
			border-bottom: 1px solid #8f908b;
		}

		.document-groups {
			max-height: 270px;
		}

		.document-header {
			align-items: flex-start;
			flex-direction: column;
			padding: 18px;
		}

		.document-state {
			justify-items: start;
			max-width: 100%;
			text-align: left;
		}

		.runtime-section {
			margin: 12px;
		}

		.runtime-toolbar {
			align-items: flex-start;
			flex-direction: column;
		}

		.runtime-field {
			min-height: 520px;
			padding: 10px;
		}

		.runtime-canvas-frame {
			height: 540px;
		}

		.project-inspector {
			min-height: 650px;
			border-top: 1px solid #111719;
			border-left: 0;
		}
	}
</style>
