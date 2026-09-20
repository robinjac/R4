import {
	R4_STUDIO_PROJECT_CHANGE_EVENT,
	R4_STUDIO_PROJECT_PROTOCOL_VERSION,
	R4_STUDIO_PROJECT_REQUEST_EVENT,
	R4_STUDIO_PROJECT_RESPONSE_EVENT,
	type R4StudioProjectChange,
	type R4StudioProjectConnection,
	type R4StudioProjectErrorCode,
	type R4StudioProjectRequest,
	type R4StudioProjectResponse
} from './project-protocol.js';
import type { R4StudioSourceTransaction } from './contracts.js';
import type { R4StudioEditIntent } from './intents.js';

const REQUEST_TIMEOUT_MS = 8_000;
const RECONCILE_TIMEOUT_MS = 20_000;
const RECONCILE_POLL_MS = 100;
const MANIFEST_POLL_MS = 1_500;
const MAX_RECONNECT_ATTEMPTS = 5;

type ConnectedResponse = Extract<R4StudioProjectResponse, { type: 'connected' }>;
type MutationResponse = Extract<R4StudioProjectResponse, { type: 'mutation' | 'conflict' | 'rejected' }>;
type IntentLookupResponse = Extract<R4StudioProjectResponse, { type: 'reconciliation' | 'intent-pending' | 'intent-missing' }>;
type HistoryLookupResponse = Extract<R4StudioProjectResponse, { type: 'reconciliation' | 'history-pending' | 'history-missing' }>;

export interface R4StudioProjectClientCallbacks {
	onConnection: (connection: R4StudioProjectConnection) => void;
	onManifest: (manifest: ConnectedResponse | R4StudioProjectChange) => void;
}

export interface R4StudioProjectClient {
	connect(): Promise<ConnectedResponse>;
	read(documentId: string, expectedRevision?: string): Promise<Extract<R4StudioProjectResponse, { type: 'snapshot' | 'stale' }>>;
	rescan(): Promise<ConnectedResponse>;
	applyIntent(documentId: string, intent: R4StudioEditIntent): Promise<MutationResponse>;
	applyHistory(documentId: string, transaction: R4StudioSourceTransaction, direction: 'undo' | 'redo'): Promise<MutationResponse>;
	readAudit(): Promise<Extract<R4StudioProjectResponse, { type: 'audit' }>>;
	lookupIntent(documentId: string, intent: R4StudioEditIntent): Promise<IntentLookupResponse>;
	lookupHistory(
		documentId: string,
		transaction: R4StudioSourceTransaction,
		direction: 'undo' | 'redo'
	): Promise<HistoryLookupResponse>;
	dispose(): void;
}

export interface R4StudioHotChannel {
	send(event: string, data: unknown): void;
	on(event: string, callback: (data: never) => void): void;
	off(event: string, callback: (data: never) => void): void;
}

export class StudioProjectClientError extends Error {
	constructor(
		readonly code: R4StudioProjectErrorCode,
		message: string,
		readonly recoverable = true
	) {
		super(message);
		this.name = 'StudioProjectClientError';
	}
}

type PendingRequest = {
	resolve: (response: R4StudioProjectResponse) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
};

type ConnectionWaiter = {
	resolve: (sessionId: string) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
};

export function createStudioProjectClient(
	callbacks: R4StudioProjectClientCallbacks,
	hotChannel: R4StudioHotChannel | undefined = import.meta.hot as R4StudioHotChannel | undefined
): R4StudioProjectClient | null {
	if (!hotChannel) {
		callbacks.onConnection({ status: 'static' });
		return null;
	}
	const channel = hotChannel;

	let disposed = false;
	let requestId = 0;
	let sessionId: string | null = null;
	let sequence = 0;
	let workspace: Extract<R4StudioProjectConnection, { status: 'connected' }>['workspace'] | undefined;
	let pollTimer: ReturnType<typeof setTimeout> | undefined;
	let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	let reconnectAttempts = 0;
	let generation = 0;
	let connectPromise: Promise<ConnectedResponse> | null = null;
	let rescanPromise: Promise<ConnectedResponse> | null = null;
	const pending = new Map<number, PendingRequest>();
	const connectionWaiters = new Set<ConnectionWaiter>();

	const rejectPending = (error: Error) => {
		for (const request of pending.values()) {
			clearTimeout(request.timeout);
			request.reject(error);
		}
		pending.clear();
	};

	const resolveConnectionWaiters = (connectedSessionId: string) => {
		for (const waiter of connectionWaiters) {
			clearTimeout(waiter.timeout);
			waiter.resolve(connectedSessionId);
		}
		connectionWaiters.clear();
	};

	const rejectConnectionWaiters = (error: Error) => {
		for (const waiter of connectionWaiters) {
			clearTimeout(waiter.timeout);
			waiter.reject(error);
		}
		connectionWaiters.clear();
	};

	const handleResponse = (response: R4StudioProjectResponse) => {
		const request = pending.get(response?.requestId);
		if (!request) return;
		pending.delete(response.requestId);
		clearTimeout(request.timeout);
		if (response.protocolVersion !== R4_STUDIO_PROJECT_PROTOCOL_VERSION) {
			request.reject(new StudioProjectClientError('protocol-mismatch', 'The local Studio project protocol version changed.', false));
			return;
		}
		if (response.type === 'error') {
			request.reject(new StudioProjectClientError(response.code, response.message, response.recoverable));
			return;
		}
		request.resolve(response);
	};

	const handleChange = (change: R4StudioProjectChange) => {
		if (change.protocolVersion !== R4_STUDIO_PROJECT_PROTOCOL_VERSION || change.sessionId !== sessionId) return;
		if (change.sequence <= sequence) return;
		if (change.sequence !== sequence + 1) {
			callbacks.onConnection({ status: 'reconnecting', workspace, message: 'Reconciling a project manifest sequence gap.' });
			void client.rescan().catch((error) => markDisconnected(errorMessage(error), true));
			return;
		}
		sequence = change.sequence;
		callbacks.onManifest(change);
	};

	const handleDisconnect = () => markDisconnected('Waiting for the local project service to reconnect.', false);
	const handleReconnect = () => {
		reconnectAttempts = 0;
		clearTimeout(reconnectTimer);
		reconnectTimer = undefined;
		void client.connect().catch(() => scheduleReconnect());
	};

	channel.on(R4_STUDIO_PROJECT_RESPONSE_EVENT, handleResponse as (data: never) => void);
	channel.on(R4_STUDIO_PROJECT_CHANGE_EVENT, handleChange as (data: never) => void);
	channel.on('vite:ws:disconnect', handleDisconnect as (data: never) => void);
	channel.on('vite:ws:connect', handleReconnect as (data: never) => void);

	function send(request: R4StudioProjectRequest): Promise<R4StudioProjectResponse> {
		if (disposed) return Promise.reject(new StudioProjectClientError('request-failed', 'The local Studio project client was disposed.', false));
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				pending.delete(request.requestId);
				reject(new StudioProjectClientError('request-failed', 'The local Studio project service did not respond.'));
			}, REQUEST_TIMEOUT_MS);
			pending.set(request.requestId, { resolve, reject, timeout });
			channel.send(R4_STUDIO_PROJECT_REQUEST_EVENT, request);
		});
	}

	function markDisconnected(message: string, retry: boolean) {
		if (disposed) return;
		generation += 1;
		connectPromise = null;
		rescanPromise = null;
		sessionId = null;
		sequence = 0;
		clearTimeout(pollTimer);
		pollTimer = undefined;
		rejectPending(new StudioProjectClientError('service-unavailable', message));
		callbacks.onConnection({ status: 'disconnected', workspace, message });
		if (retry) scheduleReconnect();
	}

	function scheduleReconnect() {
		if (disposed || reconnectTimer || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
		const delay = Math.min(250 * 2 ** reconnectAttempts, 4_000);
		reconnectAttempts += 1;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = undefined;
			void client.connect().catch(() => scheduleReconnect());
		}, delay);
	}

	function schedulePoll() {
		clearTimeout(pollTimer);
		if (disposed || !sessionId) return;
		pollTimer = setTimeout(async () => {
			try {
				await client.rescan();
				schedulePoll();
			} catch (error) {
				markDisconnected(errorMessage(error), true);
			}
		}, MANIFEST_POLL_MS);
	}

	function requireSession(): string {
		if (!sessionId) throw new StudioProjectClientError('invalid-session', 'The local Studio project service is not connected.');
		return sessionId;
	}

	function waitForConnection(): Promise<string> {
		if (sessionId) return Promise.resolve(sessionId);
		return new Promise((resolve, reject) => {
			const waiter: ConnectionWaiter = {
				resolve,
				reject,
				timeout: setTimeout(() => {
					connectionWaiters.delete(waiter);
					reject(new StudioProjectClientError('service-unavailable', 'Studio could not reconcile the edit before the local service timeout.'));
				}, RECONCILE_TIMEOUT_MS)
			};
			connectionWaiters.add(waiter);
		});
	}

	async function reconcileMutation(
		expectedSession: string,
		operation: 'intent' | 'history',
		lookup: () => Promise<IntentLookupResponse | HistoryLookupResponse>
	): Promise<MutationResponse | null> {
		const deadline = Date.now() + RECONCILE_TIMEOUT_MS;
		while (!disposed && Date.now() < deadline) {
			let response: IntentLookupResponse | HistoryLookupResponse;
			try {
				response = await lookup();
			} catch (error) {
				if (error instanceof StudioProjectClientError && !error.recoverable) throw error;
				const reconciledSession = await waitForConnection().catch(() => null);
				if (reconciledSession !== expectedSession) throw error;
				await delay(RECONCILE_POLL_MS);
				continue;
			}
			if (response.type === 'intent-missing' || response.type === 'history-missing') return null;
			if (response.type === 'intent-pending' || response.type === 'history-pending') {
				await delay(RECONCILE_POLL_MS);
				continue;
			}
			if (response.operation !== operation) {
				throw new StudioProjectClientError('request-failed', 'The project service returned the wrong reconciliation result.');
			}
			if (!reconciliationIsCurrent(response.result, response.current.revision)) {
				throw new StudioProjectClientError(
					'request-failed',
					'The mutation completed, but a newer source revision superseded its retained result.'
				);
			}
			return { ...response.result, requestId: response.requestId };
		}
		throw new StudioProjectClientError(
			'request-failed',
			'The mutation outcome is still pending. Studio did not replay the write.'
		);
	}

	const client: R4StudioProjectClient = {
		async connect() {
			if (connectPromise) return connectPromise;
			const currentGeneration = ++generation;
			callbacks.onConnection(
				workspace
					? { status: 'reconnecting', workspace, message: 'Establishing a fresh local project session.' }
					: { status: 'connecting' }
			);
			const operation = (async () => {
				try {
					const response = await send({
						type: 'connect',
						protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
						requestId: ++requestId
					});
					if (response.type !== 'connected') throw new StudioProjectClientError('request-failed', 'The project service returned an invalid handshake.');
					if (disposed || currentGeneration !== generation) throw new StudioProjectClientError('invalid-session', 'A newer Studio project connection replaced this handshake.');
					sessionId = response.sessionId;
					sequence = response.sequence;
					workspace = response.workspace;
					reconnectAttempts = 0;
					clearTimeout(reconnectTimer);
					reconnectTimer = undefined;
					callbacks.onConnection({ status: 'connected', sessionId, sequence, workspace });
					callbacks.onManifest(response);
					resolveConnectionWaiters(response.sessionId);
					schedulePoll();
					return response;
				} catch (error) {
					if (!disposed && currentGeneration === generation) {
						const clientError = asClientError(error);
						callbacks.onConnection({ status: 'failed', code: clientError.code, message: clientError.message });
					}
					throw error;
				}
			})();
			connectPromise = operation;
			try {
				return await operation;
			} finally {
				if (connectPromise === operation) connectPromise = null;
			}
		},
		async read(documentId, expectedRevision) {
			const response = await send({
				type: 'read',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId: ++requestId,
				sessionId: requireSession(),
				documentId,
				expectedRevision
			});
			if (response.type !== 'snapshot' && response.type !== 'stale') throw new StudioProjectClientError('request-failed', 'The project service returned an invalid read response.');
			return response;
		},
		async rescan() {
			if (!sessionId) return client.connect();
			if (rescanPromise) return rescanPromise;
			const operation = (async () => {
				const response = await send({
					type: 'rescan',
					protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
					requestId: ++requestId,
					sessionId: requireSession()
				});
				if (response.type !== 'connected') throw new StudioProjectClientError('request-failed', 'The project service returned an invalid rescan response.');
				const changed = response.sessionId !== sessionId || response.sequence > sequence;
				sessionId = response.sessionId;
				sequence = response.sequence;
				workspace = response.workspace;
				callbacks.onConnection({ status: 'connected', sessionId, sequence, workspace });
				if (changed) callbacks.onManifest(response);
				return response;
			})();
			rescanPromise = operation;
			try {
				return await operation;
			} finally {
				if (rescanPromise === operation) rescanPromise = null;
			}
		},
		async applyIntent(documentId, intent) {
			const mutationSession = requireSession();
			try {
				const response = await send({
					type: 'apply-intent',
					protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
					requestId: ++requestId,
					sessionId: mutationSession,
					documentId,
					intent
				});
				if (response.type !== 'mutation' && response.type !== 'conflict' && response.type !== 'rejected') {
					throw new StudioProjectClientError('request-failed', 'The project service returned an invalid mutation response.');
				}
				return response;
			} catch (error) {
				if (error instanceof StudioProjectClientError && !error.recoverable) throw error;
				const reconciledSession = await waitForConnection().catch(() => null);
				if (reconciledSession !== mutationSession) throw error;
				const result = await reconcileMutation(mutationSession, 'intent', () => client.lookupIntent(documentId, intent));
				if (result) return result;
				throw error;
			}
		},
		async applyHistory(documentId, transaction, direction) {
			const mutationSession = requireSession();
			try {
				const response = await send({
					type: 'apply-history',
					protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
					requestId: ++requestId,
					sessionId: mutationSession,
					documentId,
					transaction,
					direction
				});
				if (response.type !== 'mutation' && response.type !== 'conflict' && response.type !== 'rejected') {
					throw new StudioProjectClientError('request-failed', 'The project service returned an invalid history response.');
				}
				return response;
			} catch (error) {
				if (error instanceof StudioProjectClientError && !error.recoverable) throw error;
				const reconciledSession = await waitForConnection().catch(() => null);
				if (reconciledSession !== mutationSession) throw error;
				const result = await reconcileMutation(mutationSession, 'history', () => client.lookupHistory(documentId, transaction, direction));
				if (result) return result;
				throw error;
			}
		},
		async readAudit() {
			const response = await send({
				type: 'read-audit',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId: ++requestId,
				sessionId: requireSession()
			});
			if (response.type !== 'audit') throw new StudioProjectClientError('request-failed', 'The project service returned an invalid audit response.');
			return response;
		},
		async lookupIntent(documentId, intent) {
			const response = await send({
				type: 'lookup-intent',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId: ++requestId,
				sessionId: requireSession(),
				documentId,
				intent
			});
			if (response.type !== 'reconciliation' && response.type !== 'intent-pending' && response.type !== 'intent-missing') {
				throw new StudioProjectClientError('request-failed', 'The project service returned an invalid intent lookup response.');
			}
			return response;
		},
		async lookupHistory(documentId, transaction, direction) {
			const response = await send({
				type: 'lookup-history',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId: ++requestId,
				sessionId: requireSession(),
				documentId,
				transaction,
				direction
			});
			if (response.type !== 'reconciliation' && response.type !== 'history-pending' && response.type !== 'history-missing') {
				throw new StudioProjectClientError('request-failed', 'The project service returned an invalid history lookup response.');
			}
			return response;
		},
		dispose() {
			disposed = true;
			generation += 1;
			clearTimeout(pollTimer);
			clearTimeout(reconnectTimer);
			const error = new StudioProjectClientError('request-failed', 'The local Studio project client was disposed.', false);
			rejectPending(error);
			rejectConnectionWaiters(error);
			channel.off(R4_STUDIO_PROJECT_RESPONSE_EVENT, handleResponse as (data: never) => void);
			channel.off(R4_STUDIO_PROJECT_CHANGE_EVENT, handleChange as (data: never) => void);
			channel.off('vite:ws:disconnect', handleDisconnect as (data: never) => void);
			channel.off('vite:ws:connect', handleReconnect as (data: never) => void);
		}
	};

	return client;
}

function asClientError(error: unknown): StudioProjectClientError {
	return error instanceof StudioProjectClientError
		? error
		: new StudioProjectClientError('request-failed', errorMessage(error));
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'The local Studio project service failed.';
}

function reconciliationIsCurrent(result: MutationResponse, currentRevision: string): boolean {
	if (result.type === 'rejected') return true;
	if (result.type === 'mutation' && result.status === 'applied') {
		return result.applied.snapshot.document.revision === currentRevision;
	}
	if (result.type === 'mutation') return result.audit.resultRevision === currentRevision;
	return result.current.document.revision === currentRevision;
}

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
