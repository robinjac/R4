import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { analyzeStudioProjectSource, MAX_STUDIO_SOURCE_LENGTH } from '../src/studio/analyze.js';
import { R4_STUDIO_PROJECT_COMPILER_PROFILE } from '../src/studio/compiler-profile.js';
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

export class StudioProjectService {
	readonly sessionId = randomUUID();
	readonly root: string;
	readonly workspace: R4StudioProjectWorkspace;
	#documents = new Map<string, R4StudioProjectDocument>();
	#issues: R4StudioProjectIssue[] = [];
	#sequence = 0;
	#listeners = new Set<StudioProjectChangeListener>();

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
			capabilities: { read: true, watch: true, write: false }
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
			issues: this.issues
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

	async rescan(emit = true): Promise<boolean> {
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

	#assertSession(sessionId: string) {
		if (sessionId !== this.sessionId) {
			throw new StudioProjectServiceError('invalid-session', 'The Studio project session is no longer current.');
		}
	}

	#assertDocumentId(documentId: string) {
		const segments = documentId.split('/');
		if (
			!documentId ||
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
