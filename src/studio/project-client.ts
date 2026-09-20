import {
	R4_STUDIO_PROJECT_CHANGE_EVENT,
	R4_STUDIO_PROJECT_PROTOCOL_VERSION,
	R4_STUDIO_PROJECT_REQUEST_EVENT,
	R4_STUDIO_PROJECT_RESPONSE_EVENT,
	type R4StudioProjectChange,
	type R4StudioProjectConnection,
	type R4StudioProjectRequest,
	type R4StudioProjectResponse
} from './project-protocol.js';
import type { R4StudioSourceTransaction } from './contracts.js';
import type { R4StudioSetPropertyIntent } from './inspector.js';

const REQUEST_TIMEOUT_MS = 8_000;
const MANIFEST_POLL_MS = 1_500;

export interface R4StudioProjectClientCallbacks {
	onConnection: (connection: R4StudioProjectConnection) => void;
	onManifest: (manifest: Extract<R4StudioProjectResponse, { type: 'connected' }> | R4StudioProjectChange) => void;
}

export interface R4StudioProjectClient {
	connect(): Promise<Extract<R4StudioProjectResponse, { type: 'connected' }>>;
	read(documentId: string, expectedRevision?: string): Promise<Extract<R4StudioProjectResponse, { type: 'snapshot' | 'stale' }>>;
	rescan(): Promise<Extract<R4StudioProjectResponse, { type: 'connected' }>>;
	setProperty(documentId: string, intent: R4StudioSetPropertyIntent): Promise<Extract<R4StudioProjectResponse, { type: 'mutation' | 'conflict' | 'rejected' }>>;
	applyTransaction(documentId: string, transaction: R4StudioSourceTransaction): Promise<Extract<R4StudioProjectResponse, { type: 'mutation' | 'conflict' | 'rejected' }>>;
	dispose(): void;
}

type PendingRequest = {
	resolve: (response: R4StudioProjectResponse) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
};

export function createStudioProjectClient(callbacks: R4StudioProjectClientCallbacks): R4StudioProjectClient | null {
	const hot = import.meta.hot;
	if (!hot) {
		callbacks.onConnection({ status: 'static' });
		return null;
	}
	const channel = hot;

	let disposed = false;
	let requestId = 0;
	let sessionId: string | null = null;
	let sequence = 0;
	let workspace: Extract<R4StudioProjectConnection, { status: 'connected' }>['workspace'] | undefined;
	let pollTimer: ReturnType<typeof setInterval> | undefined;
	const pending = new Map<number, PendingRequest>();

	const rejectPending = (message: string) => {
		for (const request of pending.values()) {
			clearTimeout(request.timeout);
			request.reject(new Error(message));
		}
		pending.clear();
	};

	const handleResponse = (response: R4StudioProjectResponse) => {
		if (response.protocolVersion !== R4_STUDIO_PROJECT_PROTOCOL_VERSION) return;
		const request = pending.get(response.requestId);
		if (!request) return;
		pending.delete(response.requestId);
		clearTimeout(request.timeout);
		if (response.type === 'error') {
			request.reject(new Error(response.message));
			return;
		}
		request.resolve(response);
	};

	const handleChange = (change: R4StudioProjectChange) => {
		if (change.protocolVersion !== R4_STUDIO_PROJECT_PROTOCOL_VERSION || change.sessionId !== sessionId) return;
		if (change.sequence <= sequence) return;
		if (change.sequence !== sequence + 1) {
			void client.rescan().catch(() => undefined);
			return;
		}
		sequence = change.sequence;
		callbacks.onManifest(change);
	};

	const handleDisconnect = () => {
		if (disposed) return;
		clearInterval(pollTimer);
		pollTimer = undefined;
		rejectPending('The local Studio project service disconnected.');
		callbacks.onConnection({ status: 'disconnected', workspace, message: 'Waiting for the local project service to reconnect.' });
	};

	const handleReconnect = () => {
		if (!disposed) void client.connect().catch(() => undefined);
	};

	channel.on(R4_STUDIO_PROJECT_RESPONSE_EVENT, handleResponse);
	channel.on(R4_STUDIO_PROJECT_CHANGE_EVENT, handleChange);
	channel.on('vite:ws:disconnect', handleDisconnect);
	channel.on('vite:ws:connect', handleReconnect);

	function send(request: R4StudioProjectRequest): Promise<R4StudioProjectResponse> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				pending.delete(request.requestId);
				reject(new Error('The local Studio project service did not respond.'));
			}, REQUEST_TIMEOUT_MS);
			pending.set(request.requestId, { resolve, reject, timeout });
			channel.send(R4_STUDIO_PROJECT_REQUEST_EVENT, request);
		});
	}

	const client: R4StudioProjectClient = {
		async connect() {
			callbacks.onConnection({ status: 'connecting' });
			try {
				const response = await send({
					type: 'connect',
					protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
					requestId: ++requestId
				});
				if (response.type !== 'connected') throw new Error('The project service returned an invalid handshake.');
				sessionId = response.sessionId;
				sequence = response.sequence;
				workspace = response.workspace;
				callbacks.onConnection({ status: 'connected', sessionId, sequence, workspace });
				callbacks.onManifest(response);
				if (!pollTimer) {
					pollTimer = setInterval(() => void client.rescan().catch(() => undefined), MANIFEST_POLL_MS);
				}
				return response;
			} catch (error) {
				callbacks.onConnection({
					status: 'failed',
					code: 'request-failed',
					message: error instanceof Error ? error.message : 'The local project service failed.'
				});
				throw error;
			}
		},
		async read(documentId, expectedRevision) {
			if (!sessionId) throw new Error('The local Studio project service is not connected.');
			const response = await send({
				type: 'read',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId: ++requestId,
				sessionId,
				documentId,
				expectedRevision
			});
			if (response.type !== 'snapshot' && response.type !== 'stale') throw new Error('The project service returned an invalid read response.');
			return response;
		},
		async rescan() {
			if (!sessionId) return client.connect();
			const response = await send({
				type: 'rescan',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId: ++requestId,
				sessionId
			});
			if (response.type !== 'connected') throw new Error('The project service returned an invalid rescan response.');
			const changed = response.sessionId !== sessionId || response.sequence > sequence;
			sessionId = response.sessionId;
			sequence = response.sequence;
			workspace = response.workspace;
			if (changed) callbacks.onManifest(response);
			return response;
		},
		async setProperty(documentId, intent) {
			if (!sessionId) throw new Error('The local Studio project service is not connected.');
			const response = await send({
				type: 'set-property',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId: ++requestId,
				sessionId,
				documentId,
				intent
			});
			if (response.type !== 'mutation' && response.type !== 'conflict' && response.type !== 'rejected') {
				throw new Error('The project service returned an invalid mutation response.');
			}
			return response;
		},
		async applyTransaction(documentId, transaction) {
			if (!sessionId) throw new Error('The local Studio project service is not connected.');
			const response = await send({
				type: 'apply-transaction',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId: ++requestId,
				sessionId,
				documentId,
				transaction
			});
			if (response.type !== 'mutation' && response.type !== 'conflict' && response.type !== 'rejected') {
				throw new Error('The project service returned an invalid mutation response.');
			}
			return response;
		},
		dispose() {
			disposed = true;
			clearInterval(pollTimer);
			rejectPending('The local Studio project client was disposed.');
			channel.off(R4_STUDIO_PROJECT_RESPONSE_EVENT, handleResponse);
			channel.off(R4_STUDIO_PROJECT_CHANGE_EVENT, handleChange);
			channel.off('vite:ws:disconnect', handleDisconnect);
			channel.off('vite:ws:connect', handleReconnect);
		}
	};

	return client;
}
