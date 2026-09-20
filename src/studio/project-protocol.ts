import type { R4StudioDocumentRef, R4StudioSnapshot } from './types.js';
import type { R4StudioAppliedTransaction, R4StudioSourceTransaction } from './contracts.js';
import type { R4StudioAuditRecord } from './audit.js';
import type { R4StudioEditIntent } from './intents.js';

export const R4_STUDIO_PROJECT_PROTOCOL_VERSION = 2 as const;
export const R4_STUDIO_PROJECT_REQUEST_EVENT = 'r4:studio:project:request';
export const R4_STUDIO_PROJECT_RESPONSE_EVENT = 'r4:studio:project:response';
export const R4_STUDIO_PROJECT_CHANGE_EVENT = 'r4:studio:project:change';

export interface R4StudioProjectDocument {
	id: string;
	title: string;
	parent: string;
	revision: string;
}

export interface R4StudioProjectIssue {
	code: 'unreadable-path' | 'document-limit' | 'depth-limit';
	path?: string;
	message: string;
}

export interface R4StudioProjectWorkspace {
	name: string;
	preview: 'repository' | 'none';
	capabilities: {
		read: true;
		watch: true;
		write: boolean;
	};
}

export type R4StudioProjectConnection =
	| { status: 'static' }
	| { status: 'connecting' }
	| { status: 'reconnecting'; workspace?: R4StudioProjectWorkspace; message: string }
	| {
			status: 'connected';
			sessionId: string;
			sequence: number;
			workspace: R4StudioProjectWorkspace;
	  }
	| { status: 'disconnected'; workspace?: R4StudioProjectWorkspace; message: string }
	| { status: 'failed'; code: R4StudioProjectErrorCode; message: string };

export type R4StudioDocumentFreshness =
	| 'loading'
	| 'current'
	| 'refreshing'
	| 'stale'
	| 'deleted'
	| 'unknown'
	| 'failed';

export type R4StudioProjectErrorCode =
	| 'service-unavailable'
	| 'protocol-mismatch'
	| 'invalid-session'
	| 'invalid-document'
	| 'document-not-found'
	| 'document-too-large'
	| 'invalid-encoding'
	| 'unstable-read'
	| 'workspace-unavailable'
	| 'request-failed';

export type R4StudioProjectRequest =
	| {
			type: 'connect';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
	  }
	| {
			type: 'read';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			documentId: string;
			expectedRevision?: string;
	  }
	| {
			type: 'rescan';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
	  }
	| {
			type: 'apply-intent';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			documentId: string;
			intent: R4StudioEditIntent;
	  }
	| {
			type: 'apply-history';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			documentId: string;
			transaction: R4StudioSourceTransaction;
			direction: 'undo' | 'redo';
	  }
	| {
			type: 'read-audit';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
	  }
	| {
			type: 'lookup-intent';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			documentId: string;
			intent: R4StudioEditIntent;
	  }
	| {
			type: 'lookup-history';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			documentId: string;
			transaction: R4StudioSourceTransaction;
			direction: 'undo' | 'redo';
	  };

export type R4StudioMutationResult =
	| {
			type: 'mutation';
			status: 'applied';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			applied: R4StudioAppliedTransaction;
			audit: R4StudioAuditRecord;
	  }
	| {
			type: 'mutation';
			status: 'unchanged';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			audit: R4StudioAuditRecord;
	  }
	| {
			type: 'conflict';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			expected: R4StudioDocumentRef;
			current: R4StudioSnapshot;
			audit: R4StudioAuditRecord;
	  }
	| {
			type: 'rejected';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			code: string;
			reason: string;
			audit: R4StudioAuditRecord;
	  };

export type R4StudioProjectResponse =
	| {
			type: 'connected';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			sequence: number;
			workspace: R4StudioProjectWorkspace;
			documents: R4StudioProjectDocument[];
			issues: R4StudioProjectIssue[];
			auditSequence: number;
	  }
	| {
			type: 'snapshot';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			snapshot: R4StudioSnapshot;
	  }
	| {
			type: 'stale';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			expectedRevision: string;
			current: R4StudioDocumentRef;
	  }
	| R4StudioMutationResult
	| {
			type: 'audit';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			records: R4StudioAuditRecord[];
	  }
	| {
			type: 'intent-missing';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			intentId: string;
	  }
	| {
			type: 'intent-pending';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			intentId: string;
	  }
	| {
			type: 'history-missing';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			transactionId: string;
	  }
	| {
			type: 'history-pending';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			transactionId: string;
	  }
	| {
			type: 'reconciliation';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			sessionId: string;
			operation: 'intent' | 'history';
			current: R4StudioDocumentRef;
			result: R4StudioMutationResult;
	  }
	| {
			type: 'error';
			protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
			requestId: number;
			code: R4StudioProjectErrorCode;
			message: string;
			recoverable: boolean;
	  };

export interface R4StudioProjectChange {
	type: 'manifest';
	protocolVersion: typeof R4_STUDIO_PROJECT_PROTOCOL_VERSION;
	sessionId: string;
	sequence: number;
	documents: R4StudioProjectDocument[];
	issues: R4StudioProjectIssue[];
	cause?: { type: 'transaction'; transactionId: string };
}
