import type { R4StudioIntentOrigin } from './intents.js';

export type R4StudioAuditOrigin = R4StudioIntentOrigin | { type: 'history'; direction: 'undo' | 'redo' } | { type: 'unknown' };
export type R4StudioAuditOutcome = 'applied' | 'unchanged' | 'conflict' | 'rejected';

export interface R4StudioAuditRecord {
	sequence: number;
	timestamp: string;
	sessionId: string;
	documentId: string;
	intentId?: string;
	transactionId?: string;
	operation: 'set-property' | 'undo' | 'redo' | 'invalid';
	property?: string;
	origin: R4StudioAuditOrigin;
	expectedRevision?: string;
	beforeRevision?: string;
	resultRevision?: string;
	outcome: R4StudioAuditOutcome;
	code: string;
}
