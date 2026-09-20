import type { R4StudioNodeRef, R4StudioRuntimeInstanceRef } from './types.js';

export const R4_STUDIO_EDIT_INTENT_VERSION = 1 as const;

export type R4StudioStaticPropertyValue = string | number | boolean;

export type R4StudioIntentOrigin =
	| { type: 'inspector' }
	| { type: 'canvas'; runtimeInstance?: R4StudioRuntimeInstanceRef }
	| { type: 'automation'; runId?: string };

export interface R4StudioSetPropertyOperation {
	type: 'set-property';
	property: string;
	value: R4StudioStaticPropertyValue;
}

export interface R4StudioEditIntent {
	schema: 'r4.studio.edit-intent';
	version: typeof R4_STUDIO_EDIT_INTENT_VERSION;
	id: string;
	target: R4StudioNodeRef;
	origin: R4StudioIntentOrigin;
	operation: R4StudioSetPropertyOperation;
}

export type R4StudioIntentValidation =
	| { valid: true; intent: R4StudioEditIntent }
	| {
			valid: false;
			code:
				| 'invalid-schema'
				| 'invalid-id'
				| 'invalid-target'
				| 'invalid-origin'
				| 'invalid-operation'
				| 'invalid-value';
			reason: string;
	  };

export function createStudioSetPropertyIntent(
	target: R4StudioNodeRef,
	property: string,
	value: R4StudioStaticPropertyValue,
	origin: R4StudioIntentOrigin,
	id: string = crypto.randomUUID()
): R4StudioEditIntent {
	return {
		schema: 'r4.studio.edit-intent',
		version: R4_STUDIO_EDIT_INTENT_VERSION,
		id,
		target,
		origin,
		operation: { type: 'set-property', property, value }
	};
}

export function validateStudioEditIntent(value: unknown): R4StudioIntentValidation {
	if (!isRecord(value) || value.schema !== 'r4.studio.edit-intent' || value.version !== R4_STUDIO_EDIT_INTENT_VERSION) {
		return invalid('invalid-schema', 'The Studio edit intent schema or version is not supported.');
	}
	if (!boundedString(value.id, 1, 128)) return invalid('invalid-id', 'The Studio edit intent ID is invalid.');
	if (!validNodeRef(value.target)) return invalid('invalid-target', 'The Studio edit intent target is invalid.');
	if (!validOrigin(value.origin)) return invalid('invalid-origin', 'The Studio edit intent origin is invalid.');
	if (!isRecord(value.operation) || value.operation.type !== 'set-property' || !boundedString(value.operation.property, 1, 128)) {
		return invalid('invalid-operation', 'The Studio edit operation is not supported.');
	}
	if (!isStaticValue(value.operation.value)) return invalid('invalid-value', 'The Studio edit value must be a bounded static scalar.');
	return {
		valid: true,
		intent: {
			schema: 'r4.studio.edit-intent',
			version: R4_STUDIO_EDIT_INTENT_VERSION,
			id: value.id,
			target: {
				document: { id: value.target.document.id as string, revision: value.target.document.revision as string },
				target: { kind: 'node', id: value.target.target.id as string }
			},
			origin: canonicalOrigin(value.origin),
			operation: { type: 'set-property', property: value.operation.property, value: value.operation.value }
		}
	};
}

export function serializeStudioEditIntent(intent: R4StudioEditIntent): string {
	return JSON.stringify({
		schema: intent.schema,
		version: intent.version,
		id: intent.id,
		target: intent.target,
		origin: intent.origin,
		operation: intent.operation
	});
}

function validNodeRef(value: unknown): value is R4StudioNodeRef {
	if (!isRecord(value) || !isRecord(value.document) || !isRecord(value.target)) return false;
	return (
		boundedString(value.document.id, 1, 1_024) &&
		boundedString(value.document.revision, 1, 128) &&
		value.target.kind === 'node' &&
		boundedString(value.target.id, 1, 256)
	);
}

function validOrigin(value: unknown): value is R4StudioIntentOrigin {
	if (!isRecord(value)) return false;
	if (value.type === 'inspector') return true;
	if (value.type === 'automation') return value.runId === undefined || boundedString(value.runId, 1, 128);
	if (value.type !== 'canvas') return false;
	if (value.runtimeInstance === undefined) return true;
	return (
		isRecord(value.runtimeInstance) &&
		boundedString(value.runtimeInstance.artifactId, 1, 128) &&
		boundedString(value.runtimeInstance.instanceId, 1, 256)
	);
}

function canonicalOrigin(value: R4StudioIntentOrigin): R4StudioIntentOrigin {
	if (value.type === 'inspector') return { type: 'inspector' };
	if (value.type === 'automation') return value.runId ? { type: 'automation', runId: value.runId } : { type: 'automation' };
	return value.runtimeInstance
		? {
				type: 'canvas',
				runtimeInstance: {
					artifactId: value.runtimeInstance.artifactId,
					instanceId: value.runtimeInstance.instanceId
				}
			}
		: { type: 'canvas' };
}

function isStaticValue(value: unknown): value is R4StudioStaticPropertyValue {
	return (
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isFinite(value)) ||
		(typeof value === 'string' && value.length <= 100_000)
	);
}

function boundedString(value: unknown, minimum: number, maximum: number): value is string {
	return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(code: Extract<R4StudioIntentValidation, { valid: false }>['code'], reason: string): R4StudioIntentValidation {
	return { valid: false, code, reason };
}
