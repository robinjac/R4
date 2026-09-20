import type { R4StudioDocumentRef, R4StudioSnapshot } from './types.js';

export const R4_STUDIO_PROJECT_PROTOCOL_VERSION = 1 as const;
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
}
