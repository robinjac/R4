import type { R4Platform, SourceRange } from '../lib/compiler/index.js';
import { analyzeStudioSourceWithProfile } from './analyze.js';
import type { R4StudioDocumentRef, R4StudioNodeRef, R4StudioSnapshot } from './types.js';

export const R4_STUDIO_EDIT_VERSION = 1 as const;
export const R4_STUDIO_RUNTIME_PROTOCOL_VERSION = 1 as const;

export type R4StudioEditCapability =
	| 'set-property'
	| 'insert-child'
	| 'move-child'
	| 'remove-node'
	| 'wrap-node'
	| 'replace-token';

export interface R4StudioNodeCapabilities {
	ref: R4StudioNodeRef;
	operations: R4StudioEditCapability[];
}

export interface R4StudioTextEdit {
	/** Start offset in UTF-16 code units, inclusive. */
	start: number;
	/** End offset in UTF-16 code units, exclusive. */
	end: number;
	replacement: string;
}

export interface R4StudioSourceTransaction {
	schema: 'r4.studio.source-transaction';
	version: typeof R4_STUDIO_EDIT_VERSION;
	id: string;
	document: R4StudioDocumentRef;
	label: string;
	edits: R4StudioTextEdit[];
	reverses?: string;
}

export interface R4StudioAppliedTransaction {
	snapshot: R4StudioSnapshot;
	undo: R4StudioSourceTransaction;
}

export async function applyStudioSourceTransaction(
	snapshot: R4StudioSnapshot,
	transaction: R4StudioSourceTransaction
): Promise<R4StudioAppliedTransaction> {
	assertTransaction(snapshot, transaction);
	const edits = [...transaction.edits].sort((left, right) => left.start - right.start || left.end - right.end);
	const undoEdits: R4StudioTextEdit[] = [];
	let offsetDelta = 0;

	for (const edit of edits) {
		const undoStart = edit.start + offsetDelta;
		undoEdits.push({
			start: undoStart,
			end: undoStart + edit.replacement.length,
			replacement: snapshot.source.slice(edit.start, edit.end)
		});
		offsetDelta += edit.replacement.length - (edit.end - edit.start);
	}

	let source = snapshot.source;
	for (const edit of [...edits].reverse()) {
		source = `${source.slice(0, edit.start)}${edit.replacement}${source.slice(edit.end)}`;
	}

	const nextSnapshot = await analyzeStudioSourceWithProfile(source, snapshot.document.id, snapshot.compilerProfile);
	return {
		snapshot: nextSnapshot,
		undo: {
			schema: 'r4.studio.source-transaction',
			version: R4_STUDIO_EDIT_VERSION,
			id: `${transaction.id}:undo`,
			document: nextSnapshot.document,
			label: `Undo ${transaction.label}`,
			edits: undoEdits,
			reverses: transaction.id
		}
	};
}

function assertTransaction(snapshot: R4StudioSnapshot, transaction: R4StudioSourceTransaction) {
	if (transaction.schema !== 'r4.studio.source-transaction' || transaction.version !== R4_STUDIO_EDIT_VERSION) {
		throw new Error('Unsupported R4 Studio source transaction.');
	}
	if (
		transaction.document.id !== snapshot.document.id ||
		transaction.document.revision !== snapshot.document.revision
	) {
		throw new Error('The source transaction targets a stale document revision.');
	}
	if (transaction.edits.length === 0) throw new Error('A source transaction must contain at least one edit.');

	const edits = [...transaction.edits].sort((left, right) => left.start - right.start || left.end - right.end);
	for (const [index, edit] of edits.entries()) {
		if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end) || edit.start < 0 || edit.end < edit.start || edit.end > snapshot.source.length) {
			throw new RangeError('Source transaction offsets are outside the current document.');
		}
		const previous = edits[index - 1];
		if (previous && edit.start <= previous.end) {
			throw new Error('Source transaction edits must not overlap or share a boundary.');
		}
	}
}

export type R4StudioRuntimeExecution = 'actual' | 'simulated';

export type R4StudioRuntimeState =
	| { status: 'disconnected' }
	| { status: 'connecting'; target: R4Platform; sessionId: string }
	| {
			status: 'connected';
			target: R4Platform;
			sessionId: string;
			execution: R4StudioRuntimeExecution;
			host: string;
			capabilities: string[];
	  }
	| { status: 'failed'; target?: R4Platform; message: string };

export interface R4StudioRuntimeHello {
	type: 'hello';
	protocolVersion: typeof R4_STUDIO_RUNTIME_PROTOCOL_VERSION;
	sessionId: string;
	target: R4Platform;
	execution: R4StudioRuntimeExecution;
	host: string;
	capabilities: string[];
}

export type R4StudioRuntimeMessage =
	| R4StudioRuntimeHello
	| {
			type: 'selection';
			protocolVersion: typeof R4_STUDIO_RUNTIME_PROTOCOL_VERSION;
			ref: R4StudioNodeRef;
	  }
	| {
			type: 'diagnostic';
			protocolVersion: typeof R4_STUDIO_RUNTIME_PROTOCOL_VERSION;
			severity: 'error' | 'warning' | 'info';
			message: string;
			range?: SourceRange;
	  }
	| {
			type: 'log';
			protocolVersion: typeof R4_STUDIO_RUNTIME_PROTOCOL_VERSION;
			level: 'debug' | 'info' | 'warning' | 'error';
			message: string;
	  };
