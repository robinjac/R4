<script lang="ts">
	import { base } from '$app/paths';
	import { onMount, setContext } from 'svelte';
	import { lowerToLynx } from '../lib/backends/lynx.js';
	import type { R4Node, R4Platform } from '../lib/compiler/index.js';
	import { projectPlatform, type PlatformPolicyNode } from '../lib/policy.js';
	import CompositionTree from '../workbench/CompositionTree.svelte';
	import { createStudioAutomation } from './automation.js';
	import type { R4StudioAuditRecord } from './audit.js';
	import { R4_STUDIO_PROJECT_COMPILER_PROFILE } from './compiler-profile.js';
	import type { R4StudioAppliedTransaction, R4StudioSourceTransaction } from './contracts.js';
	import {
		completeStudioRedo,
		completeStudioUndo,
		createStudioHistory,
		invalidateStudioHistory,
		recordStudioEdit
	} from './history.js';
	import type { R4StudioEditIntent } from './intents.js';
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
	import type { R4StudioNodeRef, R4StudioRuntimeInstanceRef, R4StudioSnapshot } from './types.js';

	type InspectorView = 'composition' | 'properties' | 'source' | 'semantic' | 'platform' | 'diagnostics' | 'audit';
	type MutationResponse = Extract<R4StudioProjectResponse, { type: 'mutation' | 'conflict' | 'rejected' }>;

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
		{ id: 'diagnostics', label: 'Diagnostics' },
		{ id: 'audit', label: 'Audit' }
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
	let selectionOrigin = $state<'canvas' | 'composition'>('composition');
	let canvasMode = $state<'select' | 'interact'>('select');
	let focusedRuntimeInstance = $state<R4StudioRuntimeInstanceRef | null>(null);
	let runtimeInstances = $state(0);
	let runtimeTargets = $state(0);
	let auditRecords = $state<R4StudioAuditRecord[]>([]);
	let auditState = $state<'idle' | 'loading' | 'ready' | 'stale' | 'failed'>('idle');
	let auditSessionId: string | null = null;
	let auditRequest = 0;
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
	let runtimeCanvasFrame = $state<HTMLDivElement>();
	let projectClient: R4StudioProjectClient | null = null;
	let loadRequest = 0;
	let lastLoadKey = '';
	let canvasKeyboardMarker: HTMLElement | null = null;
	const canvasTabIndexes = new WeakMap<HTMLElement, string | null>();
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
	let preview = $derived.by(() => {
		if (!selected?.preview) return null;
		if (connection.status === 'static') return selected.preview;
		if ('workspace' in connection && connection.workspace?.preview === 'repository') return selected.preview;
		return null;
	});
	let canvasPreview = $derived(
		preview && (
			connection.status === 'static'
				? !snapshot || snapshot.source === preview.source
				: snapshot?.source === preview.source &&
					snapshot.document.id === selected?.serviceId &&
					snapshot.document.revision === selected?.revision
		)
			? preview
			: null
	);
	let editingEnabled = $derived(
		connection.status === 'connected' &&
		connection.workspace.capabilities.write &&
		freshness === 'current' &&
		Boolean(
			selected?.serviceId &&
			snapshot &&
			selectedRef &&
			snapshot.document.id === selected.serviceId &&
			snapshot.document.revision === selected.revision
		)
	);
	let editingDisabledReason = $derived.by(() => {
		if (connection.status === 'static') return 'Property editing requires the loopback local project service.';
		if (connection.status === 'connecting' || connection.status === 'reconnecting') return 'Property editing is unavailable while the local project service reconnects.';
		if (connection.status === 'disconnected') return 'Property editing is unavailable while the local project service is disconnected.';
		if (connection.status === 'failed') return 'Property editing is unavailable because the local project service failed.';
		if (!connection.workspace.capabilities.write) return 'This workspace is read-only.';
		if (freshness !== 'current') return 'Refresh the authoritative source before editing.';
		if (!selected?.serviceId || !snapshot || !selectedRef) return 'Select a current project primitive before editing.';
		if (snapshot.document.id !== selected.serviceId || snapshot.document.revision !== selected.revision) return 'Refresh the authoritative source before editing.';
		if (mutationPending) return 'Wait for the current Studio mutation to finish.';
		return undefined;
	});
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
	setContext('r4:studio-automation', createStudioAutomation(commitIntent));

	$effect(() => {
		const document = selected;
		if (!document) return;
		if (document.serviceId && connection.status !== 'connected') return;
		const key = documentLoadKey(document);
		if (key === lastLoadKey || (freshness === 'deleted' && tombstone?.id === document.id)) return;
		lastLoadKey = key;
		void loadDocument(document);
	});

	$effect(() => {
		selectedRef;
		focusedRuntimeInstance;
		canvasPreview;
		canvasMode;
		queueMicrotask(updateCanvasSelection);
	});

	$effect(() => {
		if (inspectorView === 'audit' && connection.status === 'connected') void refreshAudit();
	});

	onMount(() => {
		const selectFromLocation = () => {
			const requested = new URL(window.location.href).searchParams.get('document');
			requestedDocumentId = requested || defaultDocument?.id || '';
			const nextSelectedId = studioProjectDocument(requestedDocumentId, documents)?.id || defaultDocument?.id || '';
			if (nextSelectedId !== selectedId) clearDocumentView('Loading the selected project source.');
			selectedId = nextSelectedId;
		};
		selectFromLocation();
		window.addEventListener('popstate', selectFromLocation);
		projectClient = createStudioProjectClient({
		onConnection(nextConnection) {
				connection = nextConnection;
				if (nextConnection.status === 'disconnected' || nextConnection.status === 'reconnecting') {
					freshness = 'unknown';
					projectMessage = nextConnection.message;
					history = invalidateStudioHistory();
					auditState = auditRecords.length > 0 ? 'stale' : 'failed';
				}
				if (nextConnection.status === 'connected') {
					if (auditSessionId !== nextConnection.sessionId) {
						auditSessionId = nextConnection.sessionId;
						auditRecords = [];
						auditState = 'idle';
					}
					void refreshAudit();
				}
				if (nextConnection.status === 'failed') {
					freshness = 'failed';
					projectMessage = nextConnection.message;
					history = invalidateStudioHistory();
					auditState = 'failed';
				}
			},
			onManifest(manifest) {
				adoptManifest(manifest);
			}
		});
		if (projectClient) void projectClient.connect().catch(() => undefined);
		const canvasObserver = new MutationObserver(updateCanvasSelection);
		if (runtimeCanvasFrame) {
			canvasObserver.observe(runtimeCanvasFrame, { childList: true, subtree: true });
			runtimeCanvasFrame.addEventListener('click', selectCanvasNode, true);
			runtimeCanvasFrame.addEventListener('keydown', selectCanvasNode, true);
			runtimeCanvasFrame.addEventListener('focusin', containCanvasFocus, true);
		}
		hydrated = true;
		return () => {
			window.removeEventListener('popstate', selectFromLocation);
			projectClient?.dispose();
			canvasObserver.disconnect();
			runtimeCanvasFrame?.removeEventListener('click', selectCanvasNode, true);
			runtimeCanvasFrame?.removeEventListener('keydown', selectCanvasNode, true);
			runtimeCanvasFrame?.removeEventListener('focusin', containCanvasFocus, true);
		};
	});

	async function loadDocument(document: R4StudioProjectDocument) {
		const request = ++loadRequest;
		const documentId = document.id;
		freshness = snapshot ? 'refreshing' : 'loading';
		projectMessage = freshness === 'refreshing' ? 'Refreshing the revision-qualified project snapshot.' : 'Loading the selected project source.';
		selectedRef = null;
		selectionOrigin = 'composition';
		focusedRuntimeInstance = null;
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
			if (request !== loadRequest || selected?.id !== documentId) return;
			if (
				document.serviceId &&
				(nextSnapshot.document.id !== document.serviceId || selected.revision !== nextSnapshot.document.revision)
			) {
				lastLoadKey = '';
				freshness = 'refreshing';
				projectMessage = 'The project manifest advanced while Studio loaded this source.';
				return;
			}
			snapshot = nextSnapshot;
			freshness = 'current';
			projectMessage = 'The source snapshot matches the local project service.';
			const firstNode = nextSnapshot.compilation.ir?.root[0];
			if (firstNode) selectedRef = createStudioNodeRef(nextSnapshot, firstNode.id);
		} catch (error) {
			if (request !== loadRequest || selected?.id !== documentId) return;
			freshness = connection.status === 'disconnected' ? 'unknown' : 'failed';
			projectMessage = error instanceof Error ? error.message : 'The project source could not be loaded.';
		}
	}

	function documentLoadKey(document: R4StudioProjectDocument): string {
		const mode = connection.status === 'connected' && document.serviceId ? `service:${connection.sessionId}` : 'static';
		return `${mode}:${document.serviceId ?? document.id}:${document.revision ?? document.preview?.source.length ?? 0}`;
	}

	function clearDocumentView(message: string) {
		loadRequest += 1;
		lastLoadKey = '';
		snapshot = null;
		selectedRef = null;
		selectionOrigin = 'composition';
		focusedRuntimeInstance = null;
		freshness = connection.status === 'connected' ? 'loading' : 'unknown';
		projectMessage = message;
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
			tombstone = null;
		}
		if (connection.status === 'connected') connection = { ...connection, sequence: manifest.sequence };
		const active = studioProjectDocument(selectedId, nextDocuments);
		if (
			connection.status === 'connected' &&
			snapshot &&
			active?.serviceId === snapshot.document.id &&
			active.revision === snapshot.document.revision
		) {
			freshness = 'current';
			projectMessage = 'The source snapshot matches the local project service.';
			lastLoadKey = documentLoadKey(active);
		} else {
			lastLoadKey = '';
			if (!active && !tombstone) {
				loadRequest += 1;
				snapshot = null;
				selectedRef = null;
				selectionOrigin = 'composition';
				focusedRuntimeInstance = null;
				freshness = 'unknown';
				projectMessage = 'No R4 project documents are available in this workspace.';
			} else if (active?.serviceId && snapshot && snapshot.document.id !== active.serviceId) {
				loadRequest += 1;
				snapshot = null;
				selectedRef = null;
				selectionOrigin = 'composition';
				focusedRuntimeInstance = null;
				freshness = 'loading';
				projectMessage = 'Loading the selected project source.';
			}
		}
	}

	function selectDocument(document: R4StudioProjectDocument, updateHistory = true) {
		if (document.id !== selectedId) clearDocumentView(
			connection.status === 'connected'
				? 'Loading the selected project source.'
				: 'The selected project source will load after the local service reconnects.'
		);
		selectedId = document.id;
		requestedDocumentId = document.id;
		tombstone = null;
		lastLoadKey = '';
		history = invalidateStudioHistory();
		mutationMessage = '';
		selectionOrigin = 'composition';
		focusedRuntimeInstance = null;
		if (!updateHistory || typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		url.searchParams.set('document', document.id);
		window.history.pushState({}, '', url);
	}

	function retrySource() {
		if (!selected) return;
		lastLoadKey = documentLoadKey(selected);
		void loadDocument(selected);
	}

	function selectNode(node: R4Node) {
		if (!snapshot) return;
		selectedRef = createStudioNodeRef(snapshot, node.id);
		selectionOrigin = 'composition';
		focusedRuntimeInstance = null;
	}

	function selectCanvasNode(event: Event) {
		if (canvasMode !== 'select' || !snapshot || !canvasPreview || snapshot.source !== canvasPreview.source) return;
		const target = event.composedPath().find(
			(candidate): candidate is HTMLElement =>
				candidate instanceof HTMLElement &&
				candidate.dataset.r4StudioArtifact === canvasPreview.studioArtifactId &&
				Boolean(candidate.dataset.r4StudioNode)
		);
		if (!target?.dataset.r4StudioNode) return;
		if (event instanceof KeyboardEvent && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
			const markers = canvasMarkers();
			const current = canvasKeyboardMarker && markers.includes(canvasKeyboardMarker) ? canvasKeyboardMarker : target;
			const index = markers.indexOf(current);
			if (index < 0 || markers.length === 0) return;
			event.preventDefault();
			event.stopPropagation();
			const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
			const next = markers[(index + delta + markers.length) % markers.length];
			selectCanvasMarker(next);
			next.focus();
			return;
		}
		if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
		try {
			event.preventDefault();
			event.stopPropagation();
			selectCanvasMarker(target);
		} catch {
			mutationMessage = 'Canvas instrumentation belongs to another source revision and was ignored.';
		}
	}

	function selectCanvasMarker(target: HTMLElement) {
		if (!snapshot || !canvasPreview || !target.dataset.r4StudioNode) return;
		canvasKeyboardMarker = target;
		selectedRef = createStudioNodeRef(snapshot, target.dataset.r4StudioNode);
		selectionOrigin = 'canvas';
		focusedRuntimeInstance = target.dataset.r4StudioInstance
			? { artifactId: canvasPreview.studioArtifactId, instanceId: target.dataset.r4StudioInstance }
			: null;
	}

	function canvasMarkers(): HTMLElement[] {
		if (!runtimeCanvasFrame || !canvasPreview) return [];
		return [...runtimeCanvasFrame.querySelectorAll<HTMLElement>('[data-r4-studio-node]')].filter(
			(element) => element.dataset.r4StudioArtifact === canvasPreview?.studioArtifactId
		);
	}

	function updateCanvasTabStops(markers: HTMLElement[]) {
		const controls = runtimeCanvasFrame
			? [...runtimeCanvasFrame.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]')]
			: [];
		const managed = [...new Set([...markers, ...controls])];
		if (canvasMode === 'interact') {
			for (const element of managed) {
				if (!canvasTabIndexes.has(element)) continue;
				const original = canvasTabIndexes.get(element);
				if (original === null) element.removeAttribute('tabindex');
				else if (original !== undefined) element.setAttribute('tabindex', original);
				canvasTabIndexes.delete(element);
			}
			return;
		}
		const focusableMarkers = markers.filter((marker) => !marker.matches(':disabled'));
		const focused = document.activeElement instanceof HTMLElement && focusableMarkers.includes(document.activeElement)
			? document.activeElement
			: focusableMarkers.find((marker) => marker === canvasKeyboardMarker)
				?? focusableMarkers.find((marker) => marker.dataset.r4StudioFocused === 'true')
				?? focusableMarkers.find((marker) => marker.dataset.r4StudioSelected === 'true')
				?? focusableMarkers[0];
		for (const element of managed) {
			if (!canvasTabIndexes.has(element)) canvasTabIndexes.set(element, element.getAttribute('tabindex'));
			element.tabIndex = element === focused ? 0 : -1;
		}
	}

	function containCanvasFocus(event: FocusEvent) {
		if (canvasMode !== 'select' || !(event.target instanceof HTMLElement)) return;
		if (canvasMarkers().includes(event.target)) return;
		const marker = runtimeCanvasFrame?.querySelector<HTMLElement>('[data-r4-studio-node][tabindex="0"]');
		if (marker && marker !== event.target) marker.focus();
	}

	function updateCanvasSelection() {
		if (!runtimeCanvasFrame) return;
		for (const element of runtimeCanvasFrame.querySelectorAll<HTMLElement>('[data-r4-studio-selected]')) {
			delete element.dataset.r4StudioSelected;
			delete element.dataset.r4StudioFocused;
		}
		const markers = canvasMarkers();
		if (canvasKeyboardMarker && !markers.includes(canvasKeyboardMarker)) canvasKeyboardMarker = null;
		const mountedFocus = focusedRuntimeInstance;
		if (
			mountedFocus &&
			!markers.some(
				(marker) =>
					marker.dataset.r4StudioArtifact === mountedFocus.artifactId &&
					marker.dataset.r4StudioInstance === mountedFocus.instanceId
			)
		) focusedRuntimeInstance = null;
		if (
			!selectedRef ||
			selectedRef.document.revision !== snapshot?.document.revision ||
			!canvasPreview ||
			snapshot.source !== canvasPreview.source
		) {
			runtimeInstances = 0;
			runtimeTargets = 0;
			updateCanvasTabStops(markers);
			return;
		}

		const instances = new Set<string>();
		const targets = new Set<HTMLElement>();
		const selectedMarkers = markers.filter((element) => element.dataset.r4StudioNode === selectedRef?.target.id);
		for (const marker of selectedMarkers) {
			const instanceId = marker.dataset.r4StudioInstance;
			if (instanceId) instances.add(instanceId);
			marker.dataset.r4StudioSelected = 'true';
			if (
				instanceId &&
				focusedRuntimeInstance?.artifactId === canvasPreview.studioArtifactId &&
				instanceId === focusedRuntimeInstance.instanceId
			) marker.dataset.r4StudioFocused = 'true';
			targets.add(marker);
		}
		runtimeInstances = instances.size;
		runtimeTargets = targets.size;
		updateCanvasTabStops(markers);
	}

	async function commitIntent(intent: R4StudioEditIntent): Promise<MutationResponse | null> {
		if (!projectClient || mutationPending) return null;
		mutationPending = true;
		pendingTransactionId = intent.id;
		mutationMessage = '';
		try {
			const response = await projectClient.applyIntent(intent.target.document.id, intent);
			const targetsSelectedDocument = selected?.serviceId === intent.target.document.id;
			adoptAudit(response.audit);
			if (response.type === 'mutation' && response.status === 'applied') {
				const adopted = adoptAppliedTransaction(response.applied);
				if (adopted) {
					history = recordStudioEdit(history, response.applied.undo);
					mutationMessage = `${response.applied.undo.label.replace(/^Undo /, '')} applied.`;
				}
			} else if (response.type === 'mutation') {
				if (targetsSelectedDocument) mutationMessage = 'The property already has that value.';
			} else if (response.type === 'conflict') {
				if (targetsSelectedDocument) adoptConflict(response.current);
			} else {
				if (targetsSelectedDocument) mutationMessage = response.reason;
			}
			return response;
		} catch (error) {
			if (selected?.serviceId === intent.target.document.id) {
				mutationMessage = error instanceof Error ? error.message : 'The Studio edit intent failed.';
			}
			return null;
		} finally {
			mutationPending = false;
			pendingTransactionId = null;
		}
	}

	async function undo() {
		const transaction = history.undo.at(-1);
		if (!transaction) return;
		const applied = await applyHistoryTransaction(transaction, 'undo');
		if (applied) history = completeStudioUndo(history, applied.undo);
	}

	async function redo() {
		const transaction = history.redo.at(-1);
		if (!transaction) return;
		const applied = await applyHistoryTransaction(transaction, 'redo');
		if (applied) history = completeStudioRedo(history, applied.undo);
	}

	async function applyHistoryTransaction(
		transaction: R4StudioSourceTransaction,
		direction: 'undo' | 'redo'
	): Promise<R4StudioAppliedTransaction | null> {
		if (!projectClient || mutationPending) return null;
		const documentId = transaction.document.id;
		mutationPending = true;
		pendingTransactionId = transaction.id;
		mutationMessage = '';
		try {
			const response = await projectClient.applyHistory(documentId, transaction, direction);
			adoptAudit(response.audit);
			if (response.type === 'mutation' && response.status === 'applied') {
				const adopted = adoptAppliedTransaction(response.applied);
				if (adopted) mutationMessage = `${transaction.label} applied.`;
				return adopted ? response.applied : null;
			}
			if (response.type === 'conflict' && selected?.serviceId === documentId) adoptConflict(response.current);
			else if (selected?.serviceId === documentId) mutationMessage = response.type === 'rejected' ? response.reason : 'The source already matches this history entry.';
			return null;
		} catch (error) {
			if (selected?.serviceId === documentId) {
				mutationMessage = error instanceof Error ? error.message : 'The history transaction failed.';
			}
			return null;
		} finally {
			mutationPending = false;
			pendingTransactionId = null;
		}
	}

	async function refreshAudit() {
		if (!projectClient || connection.status !== 'connected') return;
		const sessionId = connection.sessionId;
		const request = ++auditRequest;
		auditState = 'loading';
		try {
			const response = await projectClient.readAudit();
			if (request === auditRequest && connection.status === 'connected' && connection.sessionId === sessionId) {
				auditRecords = response.records;
				auditState = 'ready';
			}
		} catch {
			if (request === auditRequest) auditState = 'failed';
		}
	}

	function adoptAudit(record: R4StudioAuditRecord) {
		const currentSession = auditRecords[0]?.sessionId;
		const records = currentSession && currentSession !== record.sessionId ? [] : auditRecords;
		auditRecords = [...records.filter((candidate) => candidate.sequence !== record.sequence), record].slice(-100);
		auditState = 'ready';
	}

	function adoptAppliedTransaction(applied: R4StudioAppliedTransaction): boolean {
		const documentId = applied.snapshot.document.id;
		if (connection.status === 'connected') {
			documents = documents.map((document) =>
				document.serviceId === documentId ? { ...document, revision: applied.snapshot.document.revision } : document
			);
		}
		if (selected?.serviceId !== documentId) return false;
		loadRequest += 1;
		const previousNode = selectedNode;
		snapshot = applied.snapshot;
		freshness = 'current';
		projectMessage = 'The Studio transaction matches the local project source.';
		const nextNode = previousNode
			? findStudioNodeAtOffset(applied.snapshot, Math.min(previousNode.range.start.offset + 1, applied.snapshot.source.length))
			: applied.snapshot.compilation.ir?.root[0] ?? null;
		selectedRef = nextNode ? createStudioNodeRef(applied.snapshot, nextNode.id) : null;
		focusedRuntimeInstance = null;
		if (connection.status === 'connected') lastLoadKey = `service:${connection.sessionId}:${documentId}:${applied.snapshot.document.revision}`;
		return true;
	}

	function adoptConflict(current: R4StudioSnapshot) {
		const documentId = current.document.id;
		if (connection.status === 'connected') {
			documents = documents.map((document) =>
				document.serviceId === documentId ? { ...document, revision: current.document.revision } : document
			);
		}
		if (selected?.serviceId !== documentId) return;
		loadRequest += 1;
		snapshot = current;
		freshness = 'current';
		history = invalidateStudioHistory();
		mutationMessage = 'The edit was rejected because the source changed outside Studio. The current source was reloaded.';
		const firstNode = current.compilation.ir?.root[0];
		selectedRef = firstNode ? createStudioNodeRef(current, firstNode.id) : null;
		selectionOrigin = 'composition';
		focusedRuntimeInstance = null;
		if (connection.status === 'connected') lastLoadKey = `service:${connection.sessionId}:${documentId}:${current.document.revision}`;
	}

	function findPlatformNode(nodes: PlatformPolicyNode[], id: string): PlatformPolicyNode | null {
		for (const node of nodes) {
			if (node.id === id) return node;
			const child = findPlatformNode(node.children, id);
			if (child) return child;
		}
		return null;
	}

	function handleInspectorTabKeydown(event: KeyboardEvent, index: number) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const next = event.key === 'Home'
			? 0
			: event.key === 'End'
				? inspectorViews.length - 1
				: (index + (event.key === 'ArrowRight' ? 1 : -1) + inspectorViews.length) % inspectorViews.length;
		inspectorView = inspectorViews[next].id;
		const tabs = (event.currentTarget as HTMLButtonElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
		tabs?.[next]?.focus();
	}

	function retryConnection() {
		void projectClient?.connect().catch(() => undefined);
	}

	function auditOriginLabel(record: R4StudioAuditRecord): string {
		if (record.origin.type === 'history') return record.origin.direction;
		if (record.origin.type === 'automation') return record.origin.runId ? `automation / ${record.origin.runId}` : 'automation';
		return record.origin.type;
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
		if (connection.status === 'reconnecting') return 'Reconciling local service';
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
			<strong>{'workspace' in connection && connection.workspace ? connection.workspace.name : 'R4 framework repository'}</strong>
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
				{#if connection.status === 'disconnected' || connection.status === 'failed'}
					<button type="button" onclick={retryConnection}>Retry connection</button>
				{:else if connection.status === 'connected' && freshness === 'failed'}
					<button type="button" onclick={retrySource}>Retry source</button>
				{/if}
			</div>
		</header>

		<section class="runtime-section" aria-label="Application runtime" aria-busy={freshness === 'loading' || freshness === 'refreshing'}>
			<header class="runtime-toolbar">
				<div class="runtime-state" data-mode={platform === 'web' && canvasPreview ? 'actual' : 'simulated'}>
					<span aria-hidden="true"></span>
					<div>
						<strong>{platform === 'web' ? (canvasPreview ? 'Actual Svelte web runtime' : preview ? 'Preview revision synchronizing' : 'Analysis-only project source') : `Simulated ${platforms.find((item) => item.id === platform)?.label} policy`}</strong>
						<small>{platform === 'web' ? (canvasPreview ? 'SSR + hydration / revision-matched Studio instrumentation' : preview ? 'Execution paused until source and preview revisions match' : 'Source is analyzed but never executed in the Studio origin') : 'Browser approximation / not native execution'}</small>
					</div>
				</div>
				<div class="canvas-mode" role="group" aria-label="Canvas mode">
					<button type="button" class:active={canvasMode === 'select'} aria-pressed={canvasMode === 'select'} onclick={() => (canvasMode = 'select')}>Select</button>
					<button type="button" class:active={canvasMode === 'interact'} aria-pressed={canvasMode === 'interact'} onclick={() => (canvasMode = 'interact')}>Interact</button>
				</div>
				<div class="runtime-selection" aria-live="polite">
					<span>{selectedNode ? (selectedNode.kind === 'element' ? selectedNode.primitive : selectedNode.kind === 'component' ? selectedNode.name : selectedNode.kind) : 'No selection'}</span>
					<strong>{runtimeInstances}</strong><span>instances</span><strong>{runtimeTargets}</strong><span>targets / {selectionOrigin}</span>
				</div>
				<div class="runtime-diagnostics" class:has-errors={errorCount > 0} class:has-warnings={errorCount === 0 && warningCount > 0}>
					<strong>{errorCount}</strong><span>errors</span><strong>{warningCount}</strong><span>warnings</span>
				</div>
			</header>
			{#if snapshot && selectedRef && selectionOrigin === 'canvas'}
				<details class="canvas-properties">
					<summary>Canvas properties <span>{runtimeInstances > 1 ? `Edits all ${runtimeInstances} instances` : 'Edits authored source'}</span></summary>
					<div>
						<StudioPropertiesInspector
							{snapshot}
							{selectedRef}
							disabled={!editingEnabled || mutationPending}
							disabledReason={editingDisabledReason}
							origin={{ type: 'canvas', runtimeInstance: focusedRuntimeInstance ?? undefined }}
							oncommit={commitIntent}
						/>
					</div>
				</details>
			{/if}
			<div class="runtime-field" data-platform={platform}>
				<div class="runtime-frame" data-r4-platform={platform}>
					<div class="runtime-chrome">
						<span></span><span></span><span></span>
						<small>{platform === 'web' ? 'project://web' : `project://${platform}/simulation`}</small>
					</div>
					<div class="runtime-canvas-frame" class:selecting={canvasMode === 'select'} bind:this={runtimeCanvasFrame}>
						<div class="runtime-overlays" bind:this={overlayHost}></div>
						<div class="runtime-canvas">
						{#if canvasPreview}
							{#key canvasPreview.studioArtifactId}
								{@const Preview = canvasPreview.studioComponent}
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
			{#each inspectorViews as view, index}
				<button
					type="button"
					role="tab"
					id={`inspector-tab-${view.id}`}
					aria-controls="inspector-panel"
					aria-selected={inspectorView === view.id}
					tabindex={inspectorView === view.id ? 0 : -1}
					class:active={inspectorView === view.id}
					onclick={() => (inspectorView = view.id)}
					onkeydown={(event) => handleInspectorTabKeydown(event, index)}
				>{view.label}{#if view.id === 'diagnostics'}<span>{diagnostics.length}</span>{:else if view.id === 'audit'}<span>{auditRecords.length}</span>{/if}</button>
			{/each}
		</div>
		<div id="inspector-panel" class="inspector-content" role="tabpanel" tabindex="0" aria-labelledby={`inspector-tab-${inspectorView}`} aria-busy={mutationPending}>
			<div class="mutation-message" class:empty={!mutationMessage} role="status" aria-live="polite" aria-atomic="true">{mutationMessage}</div>
			{#if inspectorView === 'composition'}
				<CompositionTree {ir} selectedNodeId={selectedNode?.id} onselect={selectNode} />
			{:else if inspectorView === 'properties'}
				{#if snapshot && selectedRef}
					<StudioPropertiesInspector
						{snapshot}
						{selectedRef}
						disabled={!editingEnabled || mutationPending}
						disabledReason={editingDisabledReason}
						origin={{ type: 'inspector' }}
						oncommit={commitIntent}
					/>
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
			{:else if inspectorView === 'diagnostics'}
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
			{:else}
				{#if connection.status === 'static'}
					<div class="inspector-empty"><strong>No local audit session</strong><span>Mutation audit records exist only in the loopback project service.</span></div>
				{:else if connection.status !== 'connected'}
					<div class="inspector-empty"><strong>Audit unavailable</strong><span>Reconnect the local project service before reading the session journal.</span></div>
				{:else if auditState === 'failed'}
					<div class="inspector-empty"><strong>Audit unavailable</strong><span>The journal could not be refreshed; existing records may be stale.</span><button type="button" onclick={refreshAudit}>Retry audit</button></div>
				{:else if auditState === 'loading' && auditRecords.length === 0}
					<div class="inspector-empty"><strong>Loading audit</strong><span>Reading the bounded journal from the local project service.</span></div>
				{:else if auditRecords.length === 0}
					<div class="inspector-empty"><strong>No mutations recorded</strong><span>This bounded session journal records outcomes without source or property values.</span></div>
				{:else}
					<ol class="audit-list" aria-label="Studio mutation audit">
						{#each [...auditRecords].reverse() as record (record.sequence)}
							<li data-outcome={record.outcome}>
								<div><strong>{record.operation}</strong><span>{record.outcome}</span></div>
								<code>#{record.sequence} / {auditOriginLabel(record)} / {record.documentId}</code>
								<small>{record.code} / {record.resultRevision?.slice(0, 10) ?? record.beforeRevision?.slice(0, 10) ?? '--'}</small>
							</li>
						{/each}
					</ol>
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

	.document-state button {
		border: 1px solid #8c918f;
		background: #f7f6f1;
		padding: 4px 7px;
		color: #005bd7;
		font: 0.52rem/1 var(--r4-font-mono);
		cursor: pointer;
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
	.runtime-diagnostics,
	.runtime-selection {
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

	.runtime-selection {
		gap: 5px;
		color: #747b7d;
		font: 0.52rem/1 var(--r4-font-mono);
	}

	.runtime-selection strong {
		color: #005bd7;
	}

	.canvas-mode {
		display: flex;
		border: 1px solid #a5a7a3;
		background: #f7f6f1;
	}

	.canvas-mode button {
		border: 0;
		background: transparent;
		padding: 5px 7px;
		color: #62696c;
		font: 0.52rem/1 var(--r4-font-mono);
		text-transform: uppercase;
		cursor: pointer;
	}

	.canvas-mode button + button {
		border-left: 1px solid #a5a7a3;
	}

	.canvas-mode button.active {
		background: #171b1e;
		color: white;
	}

	.canvas-properties {
		border-bottom: 1px solid #93938d;
		background: #202528;
		color: #e8e9e7;
	}

	.canvas-properties summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 12px;
		font-size: 0.65rem;
		font-weight: 650;
		cursor: pointer;
	}

	.canvas-properties summary span {
		color: #8fa0a5;
		font: 0.52rem/1 var(--r4-font-mono);
		font-weight: 400;
	}

	.canvas-properties > div {
		max-height: 260px;
		overflow: auto;
		border-top: 1px solid #3a4145;
		padding: 10px;
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

	.runtime-canvas-frame.selecting {
		cursor: crosshair;
	}

	.runtime-canvas,
	.runtime-overlays {
		position: absolute;
		inset: 0;
	}

	.runtime-canvas {
		overflow: auto;
	}

	.runtime-canvas-frame :global([data-r4-primitive][data-r4-studio-selected='true']) {
		outline: 2px dashed #1675d1;
		outline-offset: -2px;
	}

	.runtime-canvas-frame :global([data-r4-primitive][data-r4-studio-focused='true']) {
		outline-style: solid;
		outline-width: 3px;
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

	.mutation-message.empty {
		min-height: 0;
		border: 0;
		padding: 0;
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

	.inspector-content:focus-visible {
		outline: 2px solid #70b3f2;
		outline-offset: -2px;
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

	.audit-list {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 12px;
		list-style: none;
	}

	.audit-list li {
		display: grid;
		min-width: 0;
		gap: 7px;
		border: 1px solid #3a4145;
		background: #171c1f;
		padding: 10px;
	}

	.audit-list li > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.audit-list strong {
		font-size: 0.68rem;
		text-transform: capitalize;
	}

	.audit-list span,
	.audit-list code,
	.audit-list small {
		min-width: 0;
		overflow-wrap: anywhere;
		color: #8f9a9e;
		font: 0.54rem/1.45 var(--r4-font-mono);
	}

	.audit-list li[data-outcome='applied'] span {
		color: #6fcf97;
	}

	.audit-list li[data-outcome='conflict'] span,
	.audit-list li[data-outcome='rejected'] span {
		color: #ff9288;
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

	.inspector-empty button {
		border: 1px solid #4b555a;
		background: #26323a;
		padding: 7px 10px;
		color: #dbe9f6;
		font-size: 0.6rem;
		cursor: pointer;
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
