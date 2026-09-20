import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { analyzeStudioProjectSource, MAX_STUDIO_SOURCE_LENGTH } from '../src/studio/analyze.js';
import type { R4StudioAuditOrigin, R4StudioAuditRecord } from '../src/studio/audit.js';
import { R4_STUDIO_PROJECT_COMPILER_PROFILE } from '../src/studio/compiler-profile.js';
import { applyStudioSourceTransaction, R4_STUDIO_EDIT_VERSION, type R4StudioSourceTransaction } from '../src/studio/contracts.js';
import { planStudioEditIntent } from '../src/studio/inspector.js';
import { serializeStudioEditIntent, validateStudioEditIntent, type R4StudioEditIntent } from '../src/studio/intents.js';
import {
	R4_STUDIO_PROJECT_PROTOCOL_VERSION,
	type R4StudioProjectChange,
	type R4StudioProjectDocument,
	type R4StudioProjectErrorCode,
	type R4StudioProjectIssue,
	type R4StudioProjectResponse,
	type R4StudioProjectWorkspace
} from '../src/studio/project-protocol.js';
import { createStudioRevision } from '../src/studio/snapshot.js';

const MAX_DOCUMENTS = 2_000;
const MAX_DEPTH = 32;
const MAX_SOURCE_BYTES = MAX_STUDIO_SOURCE_LENGTH * 4;
const MAX_AUDIT_RECORDS = 100;
const MAX_INTENT_RESULTS = 1_000;
const MAX_RECONCILIATION_RESULTS = 32;
const MAX_HISTORY_TRANSACTIONS = 200;
const IGNORED_DIRECTORIES = new Set([
	'.git',
	'.svelte-kit',
	'.vercel',
	'.netlify',
	'.output',
	'build',
	'dist',
	'node_modules',
	'playwright-report',
	'test-results',
	'blob-report'
]);

export class StudioProjectServiceError extends Error {
	constructor(
		readonly code: R4StudioProjectErrorCode,
		message: string,
		readonly recoverable = true
	) {
		super(message);
		this.name = 'StudioProjectServiceError';
	}
}

export interface StudioProjectServiceOptions {
	workspaceRoot: string;
	viteRoot: string;
}

export type StudioProjectChangeListener = (change: R4StudioProjectChange) => void;

type MutationResponse = Extract<R4StudioProjectResponse, { type: 'mutation' | 'conflict' | 'rejected' }>;
type AuditInput = Omit<R4StudioAuditRecord, 'sequence' | 'timestamp' | 'sessionId' | 'outcome' | 'code'>;

export class StudioProjectService {
	readonly sessionId = randomUUID();
	readonly root: string;
	readonly workspace: R4StudioProjectWorkspace;
	#documents = new Map<string, R4StudioProjectDocument>();
	#issues: R4StudioProjectIssue[] = [];
	#sequence = 0;
	#listeners = new Set<StudioProjectChangeListener>();
	#mutationQueues = new Map<string, Promise<void>>();
	#audit: R4StudioAuditRecord[] = [];
	#auditSequence = 0;
	#intentResults = new Map<string, { fingerprint: string; response?: MutationResponse }>();
	#intentOperations = new Map<string, { fingerprint: string; response: Promise<MutationResponse> }>();
	#historyTransactions = new Map<string, { fingerprint: string; direction: 'undo' | 'redo' }>();
	#historyReservations = 0;
	#historyResults = new Map<string, { fingerprint: string; direction: 'undo' | 'redo'; response: MutationResponse }>();
	#historyOperations = new Map<string, { fingerprint: string; direction: 'undo' | 'redo'; response: Promise<MutationResponse> }>();
	#rescanOperation: Promise<boolean> | null = null;
	#rescanAgain = false;
	#rescanEmit = false;
	#manifestMutation: Promise<void> | null = null;

	private constructor(root: string, workspace: R4StudioProjectWorkspace) {
		this.root = root;
		this.workspace = workspace;
	}

	static async create(options: StudioProjectServiceOptions): Promise<StudioProjectService> {
		const requestedRoot = resolve(options.workspaceRoot);
		let root: string;
		try {
			root = await realpath(requestedRoot);
			if (!(await stat(root)).isDirectory()) throw new Error('not a directory');
		} catch {
			throw new StudioProjectServiceError('workspace-unavailable', 'The approved Studio workspace is not available.', false);
		}

		const viteRoot = await realpath(resolve(options.viteRoot));
		const service = new StudioProjectService(root, {
			name: basename(root),
			preview: root === viteRoot ? 'repository' : 'none',
			capabilities: { read: true, watch: true, write: true }
		});
		await service.rescan(false);
		return service;
	}

	get sequence(): number {
		return this.#sequence;
	}

	get documents(): R4StudioProjectDocument[] {
		return [...this.#documents.values()].sort((left, right) => left.id.localeCompare(right.id));
	}

	get issues(): R4StudioProjectIssue[] {
		return [...this.#issues];
	}

	connect(requestId: number): Extract<R4StudioProjectResponse, { type: 'connected' }> {
		return {
			type: 'connected',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId,
			sessionId: this.sessionId,
			sequence: this.#sequence,
			workspace: this.workspace,
			documents: this.documents,
			issues: this.issues,
			auditSequence: this.#auditSequence
		};
	}

	async read(
		requestId: number,
		sessionId: string,
		documentId: string,
		expectedRevision?: string
	): Promise<Extract<R4StudioProjectResponse, { type: 'snapshot' | 'stale' }>> {
		this.#assertSession(sessionId);
		this.#assertDocumentId(documentId);
		const indexed = this.#documents.get(documentId);
		if (!indexed) throw new StudioProjectServiceError('document-not-found', `The project document "${documentId}" is not available.`);

		const source = await this.#readSource(documentId);
		const revision = await createStudioRevision(documentId, source, R4_STUDIO_PROJECT_COMPILER_PROFILE);
		if (revision !== indexed.revision) await this.rescan(true);

		if (expectedRevision && revision !== expectedRevision) {
			return {
				type: 'stale',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId,
				sessionId: this.sessionId,
				expectedRevision,
				current: { id: documentId, revision }
			};
		}

		return {
			type: 'snapshot',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId,
			sessionId: this.sessionId,
			snapshot: await analyzeStudioProjectSource(source, documentId)
		};
	}

	async applyIntent(
		requestId: number,
		sessionId: string,
		documentId: string,
		value: unknown
	): Promise<MutationResponse> {
		this.#assertSession(sessionId);
		this.#assertDocumentId(documentId);
		const validation = validateStudioEditIntent(value);
		if (!validation.valid) {
			return this.#rejected(requestId, validation.code, validation.reason, {
				documentId,
				operation: 'invalid',
				origin: { type: 'unknown' }
			});
		}
		const intent = validation.intent;
		if (intent.target.document.id !== documentId) {
			return this.#rejected(requestId, 'document-mismatch', 'The Studio edit intent targets another document.', {
				documentId,
				intentId: intent.id,
				operation: intent.operation.type,
				property: intent.operation.property,
				origin: intent.origin,
				expectedRevision: intent.target.document.revision
			});
		}
		const fingerprint = intentFingerprint(intent);
		const existing = this.#intentResults.get(intent.id);
		if (existing) {
			if (existing.fingerprint === fingerprint && existing.response) {
				if (await this.#mutationResultIsCurrent(documentId, existing.response, 'undo')) return { ...existing.response, requestId };
				return this.#rejected(requestId, 'intent-result-superseded', 'The Studio edit intent completed, but a newer source revision superseded its result.', {
					documentId,
					intentId: intent.id,
					operation: intent.operation.type,
					property: intent.operation.property,
					origin: intent.origin,
					expectedRevision: intent.target.document.revision
				});
			}
			if (existing.fingerprint === fingerprint) {
				return this.#rejected(requestId, 'intent-result-expired', 'The Studio edit intent was already consumed and its result expired.', {
					documentId,
					intentId: intent.id,
					operation: intent.operation.type,
					property: intent.operation.property,
					origin: intent.origin,
					expectedRevision: intent.target.document.revision
				});
			}
			return this.#rejected(requestId, 'intent-id-reused', 'The Studio edit intent ID was already used for a different payload.', {
				documentId,
				intentId: intent.id,
				operation: intent.operation.type,
				property: intent.operation.property,
				origin: intent.origin,
				expectedRevision: intent.target.document.revision
			});
		}
		const active = this.#intentOperations.get(intent.id);
		if (active) {
			if (active.fingerprint === fingerprint) {
				const response = await active.response;
				if (await this.#mutationResultIsCurrent(documentId, response, 'undo')) return { ...response, requestId };
				return this.#rejected(requestId, 'intent-result-superseded', 'The Studio edit intent completed, but a newer source revision superseded its result.', {
					documentId,
					intentId: intent.id,
					operation: intent.operation.type,
					property: intent.operation.property,
					origin: intent.origin,
					expectedRevision: intent.target.document.revision
				});
			}
			return this.#rejected(requestId, 'intent-id-reused', 'The Studio edit intent ID is already in use for a different payload.', {
				documentId,
				intentId: intent.id,
				operation: intent.operation.type,
				property: intent.operation.property,
				origin: intent.origin,
				expectedRevision: intent.target.document.revision
			});
		}
		if (this.#intentResults.size + this.#intentOperations.size >= MAX_INTENT_RESULTS) {
			return this.#rejected(requestId, 'intent-capacity', 'The Studio edit session reached its bounded intent capacity.', {
				documentId,
				intentId: intent.id,
				operation: intent.operation.type,
				property: intent.operation.property,
				origin: intent.origin,
				expectedRevision: intent.target.document.revision
			});
		}
		const operation = this.#enqueueMutation(documentId, async () => {
			const current = await this.#currentSnapshot(documentId);
			const audit: AuditInput = {
				documentId,
				intentId: intent.id,
				operation: intent.operation.type,
				property: intent.operation.property,
				origin: intent.origin,
				expectedRevision: intent.target.document.revision,
				beforeRevision: current.document.revision
			};
			let response: MutationResponse;
			if (intent.target.document.id !== documentId || intent.target.document.revision !== current.document.revision) {
				response = this.#conflict(requestId, intent.target.document, current, audit);
			} else {
				const plan = planStudioEditIntent(current, intent);
				if (plan.status === 'unchanged') response = this.#unchanged(requestId, audit, current.document.revision);
				else if (plan.status === 'unavailable') {
					response = this.#rejected(requestId, plan.reason, `The property edit is unavailable: ${plan.reason}.`, audit);
				} else if (this.#historyTransactions.size + this.#historyReservations >= MAX_HISTORY_TRANSACTIONS) {
					response = this.#rejected(requestId, 'history-capacity', 'The Studio history capacity is full for this service session.', audit);
				} else {
					this.#historyReservations += 1;
					try {
						response = await this.#applyTransaction(requestId, documentId, current, plan.transaction, audit);
					} finally {
						this.#historyReservations -= 1;
					}
					if (response.type === 'mutation' && response.status === 'applied') this.#registerHistory(response.applied.undo, 'undo');
				}
			}
			this.#rememberIntent(intent.id, fingerprint, response);
			return response;
		});
		this.#intentOperations.set(intent.id, { fingerprint, response: operation });
		try {
			return await operation;
		} finally {
			if (this.#intentOperations.get(intent.id)?.response === operation) this.#intentOperations.delete(intent.id);
		}
	}

	async applyHistory(
		requestId: number,
		sessionId: string,
		documentId: string,
		value: unknown,
		directionValue: unknown
	): Promise<MutationResponse> {
		this.#assertSession(sessionId);
		this.#assertDocumentId(documentId);
		if (!validHistoryTransaction(value) || (directionValue !== 'undo' && directionValue !== 'redo')) {
			return this.#rejected(requestId, 'invalid-history', 'The history transaction payload is invalid.', {
				documentId,
				operation: 'invalid',
				origin: { type: 'unknown' }
			});
		}
		const transaction = value;
		const direction = directionValue;
		if (transaction.document.id !== documentId) {
			return this.#rejected(requestId, 'invalid-history', 'The history transaction targets another Studio document.', {
				documentId,
				transactionId: transaction.id,
				operation: direction,
				origin: { type: 'history', direction },
				expectedRevision: transaction.document.revision
			});
		}
		const fingerprint = transactionFingerprint(transaction);
		const completed = this.#historyResults.get(transaction.id);
		if (completed) {
			if (completed.fingerprint === fingerprint && completed.direction === direction) {
				if (await this.#mutationResultIsCurrent(documentId, completed.response, direction === 'undo' ? 'redo' : 'undo')) return { ...completed.response, requestId };
				return this.#rejected(requestId, 'history-result-superseded', 'The history transaction completed, but a newer source revision superseded its result.', {
					documentId,
					transactionId: transaction.id,
					operation: direction,
					origin: { type: 'history', direction },
					expectedRevision: transaction.document.revision
				});
			}
			return this.#rejected(requestId, 'invalid-history', 'The history transaction ID was already used for another payload.', {
				documentId,
				transactionId: transaction.id,
				operation: direction,
				origin: { type: 'history', direction },
				expectedRevision: transaction.document.revision
			});
		}
		const active = this.#historyOperations.get(transaction.id);
		if (active) {
			if (active.fingerprint === fingerprint && active.direction === direction) {
				const response = await active.response;
				if (await this.#mutationResultIsCurrent(documentId, response, direction === 'undo' ? 'redo' : 'undo')) return { ...response, requestId };
				return this.#rejected(requestId, 'history-result-superseded', 'The history transaction completed, but a newer source revision superseded its result.', {
					documentId,
					transactionId: transaction.id,
					operation: direction,
					origin: { type: 'history', direction },
					expectedRevision: transaction.document.revision
				});
			}
			return this.#rejected(requestId, 'invalid-history', 'The history transaction ID is already in use for another payload.', {
				documentId,
				transactionId: transaction.id,
				operation: direction,
				origin: { type: 'history', direction },
				expectedRevision: transaction.document.revision
			});
		}
		const issued = this.#historyTransactions.get(transaction.id);
		const audit: AuditInput = {
			documentId,
			transactionId: transaction.id,
			operation: direction,
			origin: { type: 'history', direction },
			expectedRevision: transaction.document.revision
		};
		if (!issued || issued.fingerprint !== fingerprint || issued.direction !== direction) {
			return this.#rejected(requestId, 'invalid-history', 'The history transaction was not issued by this Studio service session.', audit);
		}
		const operation = this.#enqueueMutation(documentId, async () => {
			const issued = this.#historyTransactions.get(transaction.id);
			let response: MutationResponse;
			if (!issued || issued.fingerprint !== fingerprint || issued.direction !== direction) {
				response = this.#rejected(requestId, 'invalid-history', 'The history transaction was not issued by this Studio service session.', audit);
			} else {
				const current = await this.#currentSnapshot(documentId);
				audit.beforeRevision = current.document.revision;
				if (transaction.document.revision !== current.document.revision) {
					this.#historyTransactions.delete(transaction.id);
					response = this.#conflict(requestId, transaction.document, current, audit);
				} else {
					response = await this.#applyTransaction(requestId, documentId, current, transaction, audit);
					this.#historyTransactions.delete(transaction.id);
					if (response.type === 'mutation' && response.status === 'applied') {
						const nextDirection = direction === 'undo' ? 'redo' : 'undo';
						response.applied.undo.label = `${nextDirection === 'undo' ? 'Undo' : 'Redo'} ${historyLabel(transaction.label)}`;
						this.#registerHistory(response.applied.undo, nextDirection);
					}
				}
			}
			this.#rememberHistory(transaction.id, fingerprint, direction, response);
			return response;
		});
		this.#historyOperations.set(transaction.id, { fingerprint, direction, response: operation });
		try {
			return await operation;
		} finally {
			if (this.#historyOperations.get(transaction.id)?.response === operation) this.#historyOperations.delete(transaction.id);
		}
	}

	readAudit(requestId: number, sessionId: string): Extract<R4StudioProjectResponse, { type: 'audit' }> {
		this.#assertSession(sessionId);
		return {
			type: 'audit',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId,
			sessionId: this.sessionId,
			records: [...this.#audit]
		};
	}

	async lookupIntent(
		requestId: number,
		sessionId: string,
		documentId: string,
		value: unknown
	): Promise<Extract<R4StudioProjectResponse, { type: 'reconciliation' | 'intent-pending' | 'intent-missing' }>> {
		this.#assertSession(sessionId);
		this.#assertDocumentId(documentId);
		const validation = validateStudioEditIntent(value);
		const intentId = validation.valid ? validation.intent.id : '';
		if (validation.valid && validation.intent.target.document.id === documentId) {
			const fingerprint = intentFingerprint(validation.intent);
			const active = this.#intentOperations.get(intentId);
			if (active?.fingerprint === fingerprint) {
				return {
					type: 'intent-pending',
					protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
					requestId,
					sessionId: this.sessionId,
					intentId
				};
			}
			const result = this.#intentResults.get(intentId);
			if (
				result?.fingerprint === fingerprint &&
				result.response &&
				await this.#mutationResultIsCurrent(documentId, result.response, 'undo')
			) {
				return this.#reconciliationResponse(requestId, 'intent', documentId, result.response);
			}
		}
		return {
			type: 'intent-missing',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId,
			sessionId: this.sessionId,
			intentId
		};
	}

	async lookupHistory(
		requestId: number,
		sessionId: string,
		documentId: string,
		value: unknown,
		directionValue: unknown
	): Promise<Extract<R4StudioProjectResponse, { type: 'reconciliation' | 'history-pending' | 'history-missing' }>> {
		this.#assertSession(sessionId);
		this.#assertDocumentId(documentId);
		if (validHistoryTransaction(value) && value.document.id === documentId && (directionValue === 'undo' || directionValue === 'redo')) {
			const fingerprint = transactionFingerprint(value);
			const active = this.#historyOperations.get(value.id);
			if (active?.fingerprint === fingerprint && active.direction === directionValue) {
				return {
					type: 'history-pending',
					protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
					requestId,
					sessionId: this.sessionId,
					transactionId: value.id
				};
			}
			const result = this.#historyResults.get(value.id);
			if (
				result?.fingerprint === fingerprint &&
				result.direction === directionValue &&
				await this.#mutationResultIsCurrent(documentId, result.response, directionValue === 'undo' ? 'redo' : 'undo')
			) {
				return this.#reconciliationResponse(requestId, 'history', documentId, result.response);
			}
		}
		return {
			type: 'history-missing',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId,
			sessionId: this.sessionId,
			transactionId: validHistoryTransaction(value) ? value.id : ''
		};
	}

	async rescan(emit = true): Promise<boolean> {
		this.#rescanEmit ||= emit;
		if (this.#rescanOperation) {
			this.#rescanAgain = true;
			return this.#rescanOperation;
		}
		while (this.#manifestMutation) await this.#manifestMutation;
		if (this.#rescanOperation) {
			this.#rescanAgain = true;
			return this.#rescanOperation;
		}
		const operation = (async () => {
			let changedAny = false;
			do {
				this.#rescanAgain = false;
				const emitChanges = this.#rescanEmit;
				this.#rescanEmit = false;
				const changed = await this.#refreshManifest(emitChanges);
				changedAny ||= changed;
			} while (this.#rescanAgain);
			return changedAny;
		})();
		this.#rescanOperation = operation;
		try {
			return await operation;
		} finally {
			if (this.#rescanOperation === operation) this.#rescanOperation = null;
		}
	}

	async #refreshManifest(emit: boolean): Promise<boolean> {
		const { documents, issues } = await this.#discover();
		const changed = !sameManifest(this.#documents, documents) || JSON.stringify(this.#issues) !== JSON.stringify(issues);
		this.#documents = documents;
		this.#issues = issues;
		if (changed && emit) {
			this.#sequence += 1;
			const change: R4StudioProjectChange = {
				type: 'manifest',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				sessionId: this.sessionId,
				sequence: this.#sequence,
				documents: this.documents,
				issues: this.issues
			};
			for (const listener of this.#listeners) listener(change);
		}
		return changed;
	}

	subscribe(listener: StudioProjectChangeListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	async #reconciliationResponse(
		requestId: number,
		operation: 'intent' | 'history',
		documentId: string,
		result: MutationResponse
	): Promise<Extract<R4StudioProjectResponse, { type: 'reconciliation' }>> {
		const current = await this.#currentSnapshot(documentId);
		return {
			type: 'reconciliation',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId,
			sessionId: this.sessionId,
			operation,
			current: current.document,
			result
		};
	}

	async #mutationResultIsCurrent(
		documentId: string,
		result: MutationResponse,
		inverseDirection: 'undo' | 'redo'
	): Promise<boolean> {
		if (result.type === 'rejected') return true;
		const current = await this.#currentSnapshot(documentId);
		if (mutationResultRevision(result) !== current.document.revision) return false;
		if (result.type !== 'mutation' || result.status !== 'applied') return true;
		const capability = this.#historyTransactions.get(result.applied.undo.id);
		return capability?.direction === inverseDirection && capability.fingerprint === transactionFingerprint(result.applied.undo);
	}

	async #beginManifestMutation(): Promise<() => void> {
		while (this.#manifestMutation || this.#rescanOperation) {
			if (this.#manifestMutation) await this.#manifestMutation;
			else if (this.#rescanOperation) await this.#rescanOperation;
		}
		let release!: () => void;
		const lock = new Promise<void>((resolveLock) => {
			release = resolveLock;
		});
		this.#manifestMutation = lock;
		return () => {
			if (this.#manifestMutation === lock) this.#manifestMutation = null;
			release();
		};
	}

	async #currentSnapshot(documentId: string) {
		if (!this.#documents.has(documentId)) {
			throw new StudioProjectServiceError('document-not-found', `The project document "${documentId}" is not available.`);
		}
		return analyzeStudioProjectSource(await this.#readSource(documentId), documentId);
	}

	async #applyTransaction(
		requestId: number,
		documentId: string,
		current: Awaited<ReturnType<typeof analyzeStudioProjectSource>>,
		transaction: R4StudioSourceTransaction,
		audit: AuditInput
	): Promise<MutationResponse> {
		let applied;
		try {
			applied = await applyStudioSourceTransaction(current, transaction);
			applied = {
				...applied,
				undo: { ...applied.undo, id: this.#historyCapabilityId() }
			};
		} catch (error) {
			return this.#rejected(
				requestId,
				'invalid-transaction',
				error instanceof Error ? error.message : 'The source transaction was rejected.',
				audit
			);
		}

		const releaseManifest = await this.#beginManifestMutation();
		try {
			const latest = await this.#currentSnapshot(documentId);
			if (latest.document.revision !== current.document.revision) return this.#conflict(requestId, current.document, latest, audit);
			const wrote = await this.#writeSource(documentId, current.document.revision, applied.snapshot.source);
			if (!wrote) {
				const conflict = await this.#currentSnapshot(documentId);
				return this.#conflict(requestId, current.document, conflict, audit);
			}
			try {
				await this.#refreshManifest(false);
			} catch {
				const indexed = this.#documents.get(documentId);
				if (indexed) this.#documents.set(documentId, { ...indexed, revision: applied.snapshot.document.revision });
			}
			const record = this.#recordAudit(audit, 'applied', 'applied', applied.snapshot.document.revision);
			this.#publishManifest(transaction.id);
			return {
				type: 'mutation',
				status: 'applied',
				protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
				requestId,
				sessionId: this.sessionId,
				applied,
				audit: record
			};
		} finally {
			releaseManifest();
		}
	}

	async #writeSource(documentId: string, expectedRevision: string, source: string): Promise<boolean> {
		const candidate = join(this.root, ...documentId.split('/'));
		const state = await stat(candidate);
		const temporary = join(dirname(candidate), `.${basename(candidate)}.r4-studio-${randomUUID()}.tmp`);
		let created = false;
		try {
			const handle = await open(temporary, 'wx', state.mode);
			created = true;
			try {
				await handle.writeFile(source, 'utf8');
				await handle.sync();
			} finally {
				await handle.close();
			}
			const latestSource = await this.#readSource(documentId);
			const latestRevision = await createStudioRevision(documentId, latestSource, R4_STUDIO_PROJECT_COMPILER_PROFILE);
			if (latestRevision !== expectedRevision) return false;
			await rename(temporary, candidate);
			created = false;
			return true;
		} finally {
			if (created) await unlink(temporary).catch(() => undefined);
		}
	}

	#publishManifest(transactionId?: string) {
		this.#sequence += 1;
		const change: R4StudioProjectChange = {
			type: 'manifest',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			sessionId: this.sessionId,
			sequence: this.#sequence,
			documents: this.documents,
			issues: this.issues,
			cause: transactionId ? { type: 'transaction', transactionId } : undefined
		};
		for (const listener of this.#listeners) listener(change);
	}

	#conflict(
		requestId: number,
		expected: { id: string; revision: string },
		current: Awaited<ReturnType<typeof analyzeStudioProjectSource>>,
		audit: AuditInput
	): Extract<R4StudioProjectResponse, { type: 'conflict' }> {
		return {
			type: 'conflict',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId,
			sessionId: this.sessionId,
			expected,
			current,
			audit: this.#recordAudit(audit, 'conflict', 'stale-revision', current.document.revision)
		};
	}

	#rejected(requestId: number, code: string, reason: string, audit: AuditInput): Extract<R4StudioProjectResponse, { type: 'rejected' }> {
		return {
			type: 'rejected',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId,
			sessionId: this.sessionId,
			code,
			reason,
			audit: this.#recordAudit(audit, 'rejected', code)
		};
	}

	#unchanged(
		requestId: number,
		audit: AuditInput,
		resultRevision: string
	): Extract<R4StudioProjectResponse, { type: 'mutation'; status: 'unchanged' }> {
		return {
			type: 'mutation',
			status: 'unchanged',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId,
			sessionId: this.sessionId,
			audit: this.#recordAudit(audit, 'unchanged', 'unchanged', resultRevision)
		};
	}

	#recordAudit(
		input: AuditInput,
		outcome: R4StudioAuditRecord['outcome'],
		code: string,
		resultRevision?: string
	): R4StudioAuditRecord {
		const record: R4StudioAuditRecord = {
			...input,
			sequence: ++this.#auditSequence,
			timestamp: new Date().toISOString(),
			sessionId: this.sessionId,
			outcome,
			code,
			resultRevision
		};
		this.#audit.push(record);
		if (this.#audit.length > MAX_AUDIT_RECORDS) this.#audit.splice(0, this.#audit.length - MAX_AUDIT_RECORDS);
		return record;
	}

	#rememberIntent(intentId: string, fingerprint: string, response: MutationResponse) {
		this.#intentResults.set(intentId, { fingerprint, response });
		let retained = 0;
		for (const [id, result] of [...this.#intentResults].reverse()) {
			if (!result.response) continue;
			retained += 1;
			if (retained > MAX_RECONCILIATION_RESULTS) this.#intentResults.set(id, { fingerprint: result.fingerprint });
		}
	}

	#registerHistory(transaction: R4StudioSourceTransaction, direction: 'undo' | 'redo') {
		this.#historyTransactions.set(transaction.id, { fingerprint: transactionFingerprint(transaction), direction });
	}

	#historyCapabilityId(): string {
		let id = randomUUID();
		while (this.#historyTransactions.has(id) || this.#historyResults.has(id) || this.#historyOperations.has(id)) id = randomUUID();
		return id;
	}

	#rememberHistory(
		transactionId: string,
		fingerprint: string,
		direction: 'undo' | 'redo',
		response: MutationResponse
	) {
		this.#historyResults.set(transactionId, { fingerprint, direction, response });
		while (this.#historyResults.size > MAX_RECONCILIATION_RESULTS) {
			const oldest = this.#historyResults.keys().next().value;
			if (typeof oldest !== 'string') break;
			this.#historyResults.delete(oldest);
		}
	}

	async #enqueueMutation<T>(documentId: string, operation: () => Promise<T>): Promise<T> {
		const previous = this.#mutationQueues.get(documentId) ?? Promise.resolve();
		let release!: () => void;
		const current = new Promise<void>((resolveQueue) => {
			release = resolveQueue;
		});
		const queued = previous.catch(() => undefined).then(() => current);
		this.#mutationQueues.set(documentId, queued);
		await previous.catch(() => undefined);
		try {
			return await operation();
		} finally {
			release();
			if (this.#mutationQueues.get(documentId) === queued) this.#mutationQueues.delete(documentId);
		}
	}

	#assertSession(sessionId: string) {
		if (sessionId !== this.sessionId) {
			throw new StudioProjectServiceError('invalid-session', 'The Studio project session is no longer current.');
		}
	}

	#assertDocumentId(documentId: string) {
		const segments = documentId.split('/');
		if (
			!documentId ||
			documentId.length > 1_024 ||
			documentId.includes('\0') ||
			documentId.includes('\\') ||
			isAbsolute(documentId) ||
			/^[A-Za-z]:/.test(documentId) ||
			!documentId.endsWith('.r4.svelte') ||
			segments.some((segment) => !segment || segment === '.' || segment === '..')
		) {
			throw new StudioProjectServiceError('invalid-document', 'The requested Studio document ID is invalid.');
		}
	}

	async #discover(): Promise<{ documents: Map<string, R4StudioProjectDocument>; issues: R4StudioProjectIssue[] }> {
		const documents = new Map<string, R4StudioProjectDocument>();
		const issues: R4StudioProjectIssue[] = [];

		const visit = async (directory: string, parent: string, depth: number): Promise<void> => {
			if (depth > MAX_DEPTH) {
				issues.push({ code: 'depth-limit', path: parent || undefined, message: 'The project discovery depth limit was reached.' });
				return;
			}
			let entries;
			try {
				entries = await readdir(directory, { withFileTypes: true });
			} catch {
				issues.push({ code: 'unreadable-path', path: parent || undefined, message: 'A project directory could not be read.' });
				return;
			}

			for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
				if (entry.isSymbolicLink()) continue;
				const relativeId = parent ? `${parent}/${entry.name}` : entry.name;
				const absolutePath = join(directory, entry.name);
				if (entry.isDirectory()) {
					if (!IGNORED_DIRECTORIES.has(entry.name)) await visit(absolutePath, relativeId, depth + 1);
					continue;
				}
				if (!entry.isFile() || !entry.name.endsWith('.r4.svelte')) continue;
				if (documents.size >= MAX_DOCUMENTS) {
					issues.push({ code: 'document-limit', message: `Only the first ${MAX_DOCUMENTS} project documents were indexed.` });
					return;
				}
				try {
					const source = await this.#readSource(relativeId, false);
					documents.set(relativeId, {
						id: relativeId,
						title: titleFromDocumentId(relativeId),
						parent: dirname(relativeId) === '.' ? '' : dirname(relativeId).replaceAll(sep, '/'),
						revision: await createStudioRevision(relativeId, source, R4_STUDIO_PROJECT_COMPILER_PROFILE)
					});
				} catch (error) {
					issues.push({
						code: 'unreadable-path',
						path: relativeId,
						message: error instanceof StudioProjectServiceError ? error.message : 'A project document could not be read.'
					});
				}
			}
		};

		await visit(this.root, '', 0);
		return { documents, issues };
	}

	async #readSource(documentId: string, requireIndexed = true): Promise<string> {
		this.#assertDocumentId(documentId);
		if (requireIndexed && !this.#documents.has(documentId)) {
			throw new StudioProjectServiceError('document-not-found', `The project document "${documentId}" is not available.`);
		}
		const candidate = join(this.root, ...documentId.split('/'));
		if (!isInside(this.root, candidate)) throw new StudioProjectServiceError('invalid-document', 'The requested Studio document is outside the workspace.');

		let current = this.root;
		for (const segment of documentId.split('/')) {
			current = join(current, segment);
			let entry;
			try {
				entry = await lstat(current);
			} catch {
				throw new StudioProjectServiceError('document-not-found', `The project document "${documentId}" is not available.`);
			}
			if (entry.isSymbolicLink()) throw new StudioProjectServiceError('invalid-document', 'Symbolic links are not allowed inside the Studio workspace.');
		}

		const canonical = await realpath(candidate).catch(() => null);
		if (!canonical || !isInside(this.root, canonical)) {
			throw new StudioProjectServiceError('invalid-document', 'The requested Studio document is outside the workspace.');
		}

		for (let attempt = 0; attempt < 3; attempt += 1) {
			try {
				const handle = await open(canonical, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
				try {
					const before = await handle.stat();
					if (!before.isFile()) throw new StudioProjectServiceError('invalid-document', 'The requested Studio document is not a regular file.');
					if (before.size > MAX_SOURCE_BYTES) throw new StudioProjectServiceError('document-too-large', 'The project document exceeds the Studio source limit.');
					const bytes = await handle.readFile();
					const after = await handle.stat();
					const pathState = await stat(canonical);
					if (!sameFileState(before, after) || before.dev !== pathState.dev || before.ino !== pathState.ino) continue;
					let source: string;
					try {
						source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
					} catch {
						throw new StudioProjectServiceError('invalid-encoding', 'Studio project documents must use valid UTF-8.');
					}
					if (source.length > MAX_STUDIO_SOURCE_LENGTH) {
						throw new StudioProjectServiceError('document-too-large', 'The project document exceeds the Studio source limit.');
					}
					return source;
				} finally {
					await handle.close();
				}
			} catch (error) {
				if (error instanceof StudioProjectServiceError) throw error;
				if (attempt === 2) throw new StudioProjectServiceError('unstable-read', `The project document "${documentId}" changed while it was read.`);
			}
		}
		throw new StudioProjectServiceError('unstable-read', `The project document "${documentId}" changed while it was read.`);
	}
}

export function toStudioProjectError(requestId: number, error: unknown): Extract<R4StudioProjectResponse, { type: 'error' }> {
	const serviceError = error instanceof StudioProjectServiceError
		? error
		: new StudioProjectServiceError('request-failed', 'The local Studio project request failed.');
	return {
		type: 'error',
		protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
		requestId,
		code: serviceError.code,
		message: serviceError.message,
		recoverable: serviceError.recoverable
	};
}

function isInside(root: string, candidate: string): boolean {
	const path = relative(root, candidate);
	return path !== '' && !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`);
}

function sameFileState(left: Awaited<ReturnType<Awaited<ReturnType<typeof open>>['stat']>>, right: Awaited<ReturnType<Awaited<ReturnType<typeof open>>['stat']>>): boolean {
	return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

function sameManifest(
	left: Map<string, R4StudioProjectDocument>,
	right: Map<string, R4StudioProjectDocument>
): boolean {
	if (left.size !== right.size) return false;
	for (const [id, document] of left) {
		const candidate = right.get(id);
		if (!candidate || candidate.revision !== document.revision || candidate.title !== document.title || candidate.parent !== document.parent) return false;
	}
	return true;
}

function titleFromDocumentId(documentId: string): string {
	return basename(documentId, '.r4.svelte')
		.split(/[-_]/)
		.filter(Boolean)
		.map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
		.join(' ');
}

function transactionFingerprint(transaction: R4StudioSourceTransaction): string {
	return hashFingerprint(JSON.stringify({
		schema: transaction.schema,
		version: transaction.version,
		id: transaction.id,
		document: transaction.document,
		label: transaction.label,
		edits: transaction.edits,
		reverses: transaction.reverses
	}));
}

function mutationResultRevision(result: MutationResponse): string | undefined {
	if (result.type === 'mutation' && result.status === 'applied') return result.applied.snapshot.document.revision;
	if (result.type === 'mutation') return result.audit.resultRevision;
	if (result.type === 'conflict') return result.current.document.revision;
	return undefined;
}

function intentFingerprint(intent: R4StudioEditIntent): string {
	return hashFingerprint(serializeStudioEditIntent(intent));
}

function hashFingerprint(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function historyLabel(label: string): string {
	return label.replace(/^(?:Undo |Redo )+/, '');
}

function validHistoryTransaction(value: unknown): value is R4StudioSourceTransaction {
	if (!isRecord(value) || value.schema !== 'r4.studio.source-transaction' || value.version !== R4_STUDIO_EDIT_VERSION) return false;
	if (!boundedString(value.id, 1, 256) || !boundedString(value.label, 1, 512)) return false;
	if (value.reverses !== undefined && !boundedString(value.reverses, 1, 256)) return false;
	if (!isRecord(value.document) || !boundedString(value.document.id, 1, 1_024) || !boundedString(value.document.revision, 1, 128)) return false;
	if (!Array.isArray(value.edits) || value.edits.length === 0 || value.edits.length > 1_000) return false;
	let replacementLength = 0;
	for (const edit of value.edits) {
		if (
			!isRecord(edit) ||
			!Number.isSafeInteger(edit.start) ||
			!Number.isSafeInteger(edit.end) ||
			(edit.start as number) < 0 ||
			(edit.end as number) < (edit.start as number) ||
			typeof edit.replacement !== 'string'
		) return false;
		replacementLength += edit.replacement.length;
		if (replacementLength > MAX_STUDIO_SOURCE_LENGTH) return false;
	}
	return true;
}

function boundedString(value: unknown, minimum: number, maximum: number): value is string {
	return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
