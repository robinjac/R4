import { describe, expect, test } from 'bun:test';
import type { R4StudioAuditRecord } from '../src/studio/audit.js';
import type { R4StudioSourceTransaction } from '../src/studio/contracts.js';
import { createStudioSetPropertyIntent } from '../src/studio/intents.js';
import {
	createStudioProjectClient,
	type R4StudioHotChannel
} from '../src/studio/project-client.js';
import {
	R4_STUDIO_PROJECT_PROTOCOL_VERSION,
	R4_STUDIO_PROJECT_RESPONSE_EVENT,
	type R4StudioProjectConnection,
	type R4StudioProjectRequest,
	type R4StudioProjectResponse
} from '../src/studio/project-protocol.js';

const workspace = {
	name: 'fixture',
	preview: 'repository' as const,
	capabilities: { read: true as const, watch: true as const, write: true }
};
const target = {
	document: { id: 'src/App.r4.svelte', revision: 'revision-1' },
	target: { kind: 'node' as const, id: 'node-1' }
};

class FakeHotChannel implements R4StudioHotChannel {
	readonly sent: R4StudioProjectRequest[] = [];
	onSend: (request: R4StudioProjectRequest) => void = () => undefined;
	#listeners = new Map<string, Set<(data: never) => void>>();

	send(_event: string, data: unknown) {
		const request = data as R4StudioProjectRequest;
		this.sent.push(request);
		this.onSend(request);
	}

	on(event: string, callback: (data: never) => void) {
		const listeners = this.#listeners.get(event) ?? new Set();
		listeners.add(callback);
		this.#listeners.set(event, listeners);
	}

	off(event: string, callback: (data: never) => void) {
		this.#listeners.get(event)?.delete(callback);
	}

	emit(event: string, data?: unknown) {
		for (const listener of this.#listeners.get(event) ?? []) listener(data as never);
	}
}

describe('R4 Studio project client', () => {
	test('reconciles an uncertain intent after same-session reconnect without replaying it', async () => {
		const channel = new FakeHotChannel();
		const connections: R4StudioProjectConnection[] = [];
		let sessionId = 'session-1';
		let applyCount = 0;
		let lookupCount = 0;
		channel.onSend = (request) => {
			if (request.type === 'connect') respond(channel, connected(request.requestId, sessionId));
			if (request.type === 'apply-intent') applyCount += 1;
			if (request.type === 'lookup-intent') {
				lookupCount += 1;
				respond(
					channel,
					lookupCount === 1
						? {
							type: 'intent-pending',
							protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
							requestId: request.requestId,
							sessionId,
							intentId: request.intent.id
						}
						: reconciliation(request.requestId, sessionId, request.documentId, request.intent.id, 'set-property')
				);
			}
		};
		const client = createStudioProjectClient(
			{ onConnection: (connection) => connections.push(connection), onManifest: () => undefined },
			channel
		);
		if (!client) throw new Error('Expected a project client');
		await client.connect();
		const intent = createStudioSetPropertyIntent(target, 'title', 'Changed', { type: 'inspector' }, 'intent-1');

		const pending = client.applyIntent(target.document.id, intent);
		expect(applyCount).toBe(1);
		channel.emit('vite:ws:disconnect');
		channel.emit('vite:ws:connect');
		const result = await pending;

		expect(result).toMatchObject({ type: 'mutation', status: 'unchanged', audit: { intentId: 'intent-1' } });
		expect(applyCount).toBe(1);
		expect(lookupCount).toBe(2);
		expect(connections.map((connection) => connection.status)).toContain('reconnecting');
		client.dispose();
	});

	test('does not reconcile or replay an uncertain intent in a replacement service session', async () => {
		const channel = new FakeHotChannel();
		let sessionId = 'session-1';
		let applyCount = 0;
		let lookupCount = 0;
		channel.onSend = (request) => {
			if (request.type === 'connect') respond(channel, connected(request.requestId, sessionId));
			if (request.type === 'apply-intent') applyCount += 1;
			if (request.type === 'lookup-intent') lookupCount += 1;
		};
		const client = createStudioProjectClient(
			{ onConnection: () => undefined, onManifest: () => undefined },
			channel
		);
		if (!client) throw new Error('Expected a project client');
		await client.connect();
		const pending = client.applyIntent(
			target.document.id,
			createStudioSetPropertyIntent(target, 'title', 'Changed', { type: 'inspector' }, 'intent-2')
		);
		channel.emit('vite:ws:disconnect');
		sessionId = 'session-2';
		channel.emit('vite:ws:connect');

		await expect(pending).rejects.toMatchObject({ code: 'service-unavailable' });
		expect(applyCount).toBe(1);
		expect(lookupCount).toBe(0);
		client.dispose();
	});

	test('reconciles uncertain history through lookup rather than resending the transaction', async () => {
		const channel = new FakeHotChannel();
		let applyCount = 0;
		let lookupCount = 0;
		channel.onSend = (request) => {
			if (request.type === 'connect') respond(channel, connected(request.requestId, 'session-1'));
			if (request.type === 'apply-history') applyCount += 1;
			if (request.type === 'lookup-history') {
				lookupCount += 1;
				respond(channel, reconciliation(request.requestId, 'session-1', request.documentId, request.transaction.id, request.direction));
			}
		};
		const client = createStudioProjectClient(
			{ onConnection: () => undefined, onManifest: () => undefined },
			channel
		);
		if (!client) throw new Error('Expected a project client');
		await client.connect();
		const transaction: R4StudioSourceTransaction = {
			schema: 'r4.studio.source-transaction',
			version: 1,
			id: 'history-1',
			document: target.document,
			label: 'Undo title',
			edits: [{ start: 0, end: 1, replacement: 'x' }]
		};

		const pending = client.applyHistory(target.document.id, transaction, 'undo');
		channel.emit('vite:ws:disconnect');
		channel.emit('vite:ws:connect');
		const result = await pending;

		expect(result).toMatchObject({ type: 'mutation', status: 'unchanged', audit: { transactionId: 'history-1' } });
		expect(applyCount).toBe(1);
		expect(lookupCount).toBe(1);
		client.dispose();
	});

	test('reports a static connection when no HMR channel exists', () => {
		const connections: R4StudioProjectConnection[] = [];
		const client = createStudioProjectClient(
			{ onConnection: (connection) => connections.push(connection), onManifest: () => undefined },
			undefined
		);
		expect(client).toBeNull();
		expect(connections).toEqual([{ status: 'static' }]);
	});
});

function connected(requestId: number, sessionId: string): Extract<R4StudioProjectResponse, { type: 'connected' }> {
	return {
		type: 'connected',
		protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
		requestId,
		sessionId,
		sequence: 0,
		workspace,
		documents: [],
		issues: [],
		auditSequence: 0
	};
}

function unchanged(
	requestId: number,
	sessionId: string,
	documentId: string,
	id: string,
	operation: 'set-property' | 'undo' | 'redo'
): Extract<R4StudioProjectResponse, { type: 'mutation'; status: 'unchanged' }> {
	return {
		type: 'mutation',
		status: 'unchanged',
		protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
		requestId,
		sessionId,
		audit: audit(sessionId, documentId, id, operation)
	};
}

function reconciliation(
	requestId: number,
	sessionId: string,
	documentId: string,
	id: string,
	operation: 'set-property' | 'undo' | 'redo'
): Extract<R4StudioProjectResponse, { type: 'reconciliation' }> {
	return {
		type: 'reconciliation',
		protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
		requestId,
		sessionId,
		operation: operation === 'set-property' ? 'intent' : 'history',
		current: { id: documentId, revision: 'revision-1' },
		result: unchanged(requestId, sessionId, documentId, id, operation)
	};
}

function audit(
	sessionId: string,
	documentId: string,
	id: string,
	operation: 'set-property' | 'undo' | 'redo'
): R4StudioAuditRecord {
	const history = operation === 'undo' || operation === 'redo';
	return {
		sequence: 1,
		timestamp: '2026-09-20T00:00:00.000Z',
		sessionId,
		documentId,
		intentId: history ? undefined : id,
		transactionId: history ? id : undefined,
		operation,
		origin: history ? { type: 'history', direction: operation } : { type: 'inspector' },
		outcome: 'unchanged',
		code: 'unchanged',
		resultRevision: 'revision-1'
	};
}

function respond(channel: FakeHotChannel, response: R4StudioProjectResponse) {
	channel.emit(R4_STUDIO_PROJECT_RESPONSE_EVENT, response);
}
