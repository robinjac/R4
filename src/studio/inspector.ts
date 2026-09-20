import { parse } from 'svelte/compiler';
import type { R4StudioNodeCapabilities, R4StudioSourceTransaction } from './contracts.js';
import { assertSupportedStudioCompilerProfile } from './compiler-profile.js';
import type { R4StudioEditIntent, R4StudioStaticPropertyValue } from './intents.js';
import { resolveStudioNode } from './selection.js';
import type { R4StudioNodeRef, R4StudioSnapshot } from './types.js';

export interface R4StudioOffsetRange {
	start: number;
	end: number;
}

export interface R4StudioAttributeAnchor {
	attribute: R4StudioOffsetRange;
	edit: R4StudioOffsetRange;
	expected: string;
	syntax: 'quoted-text' | 'expression' | 'boolean-shorthand';
	quote?: '"' | "'";
}

export interface R4StudioEditableProperty {
	target: R4StudioNodeRef;
	name: string;
	value: R4StudioStaticPropertyValue;
	anchor: R4StudioAttributeAnchor;
}

export interface R4StudioSetPropertyRequest {
	id: string;
	target: R4StudioNodeRef;
	property: string;
	value: R4StudioStaticPropertyValue;
}

export type R4StudioSetPropertyPlan =
	| { status: 'planned'; transaction: R4StudioSourceTransaction }
	| { status: 'unchanged' }
	| {
			status: 'unavailable';
			reason:
				| 'stale-target'
				| 'unsupported-profile'
				| 'not-primitive'
				| 'property-not-found'
				| 'dynamic-property'
				| 'unsupported-value'
				| 'type-mismatch';
	  };

type AstRecord = Record<string, unknown> & { type?: string; start?: number; end?: number };

export function inspectStudioStaticProperties(
	snapshot: R4StudioSnapshot,
	ref: R4StudioNodeRef
): R4StudioEditableProperty[] {
	try {
		assertSupportedStudioCompilerProfile(snapshot.compilerProfile);
	} catch {
		return [];
	}
	const node = resolveStudioNode(snapshot, ref);
	if (!node || node.kind !== 'element') return [];
	const component = findComponentAtRange(snapshot.source, node.range.start.offset, node.range.end.offset);
	if (!component || !Array.isArray(component.attributes)) return [];

	return component.attributes.flatMap((attribute) => {
		const property = inspectAttribute(snapshot.source, ref, attribute);
		return property ? [property] : [];
	});
}

export function studioNodeCapabilities(snapshot: R4StudioSnapshot, ref: R4StudioNodeRef): R4StudioNodeCapabilities {
	return {
		ref,
		operations: inspectStudioStaticProperties(snapshot, ref).length > 0 ? ['set-property'] : []
	};
}

export function planStudioSetProperty(
	snapshot: R4StudioSnapshot,
	intent: R4StudioSetPropertyRequest
): R4StudioSetPropertyPlan {
	if (
		intent.target.document.id !== snapshot.document.id ||
		intent.target.document.revision !== snapshot.document.revision
	) {
		return { status: 'unavailable', reason: 'stale-target' };
	}
	try {
		assertSupportedStudioCompilerProfile(snapshot.compilerProfile);
	} catch {
		return { status: 'unavailable', reason: 'unsupported-profile' };
	}
	const node = resolveStudioNode(snapshot, intent.target);
	if (!node || node.kind !== 'element') return { status: 'unavailable', reason: 'not-primitive' };
	const properties = inspectStudioStaticProperties(snapshot, intent.target);
	const property = properties.find((candidate) => candidate.name === intent.property);
	if (!property) return { status: 'unavailable', reason: 'property-not-found' };
	if (!isStaticValue(intent.value)) return { status: 'unavailable', reason: 'unsupported-value' };
	if (typeof intent.value !== typeof property.value) return { status: 'unavailable', reason: 'type-mismatch' };
	if (Object.is(intent.value, property.value)) return { status: 'unchanged' };

	let replacement: string;
	if (property.anchor.syntax === 'quoted-text') {
		if (typeof intent.value !== 'string' || !property.anchor.quote) return { status: 'unavailable', reason: 'type-mismatch' };
		replacement = escapeAttributeText(intent.value, property.anchor.quote);
	} else if (property.anchor.syntax === 'boolean-shorthand') {
		if (typeof intent.value !== 'boolean') return { status: 'unavailable', reason: 'type-mismatch' };
		replacement = intent.value ? property.name : `${property.name}={false}`;
	} else {
		if (typeof intent.value !== 'number' && typeof intent.value !== 'boolean') return { status: 'unavailable', reason: 'type-mismatch' };
		if (typeof intent.value === 'number' && !Number.isFinite(intent.value)) return { status: 'unavailable', reason: 'unsupported-value' };
		replacement = String(intent.value);
	}

	return {
		status: 'planned',
		transaction: {
			schema: 'r4.studio.source-transaction',
			version: 1,
			id: intent.id,
			document: snapshot.document,
			label: `Set ${property.name}`,
			edits: [{ start: property.anchor.edit.start, end: property.anchor.edit.end, replacement }]
		}
	};
}

export function planStudioEditIntent(snapshot: R4StudioSnapshot, intent: R4StudioEditIntent): R4StudioSetPropertyPlan {
	return planStudioSetProperty(snapshot, {
		id: intent.id,
		target: intent.target,
		property: intent.operation.property,
		value: intent.operation.value
	});
}

function inspectAttribute(
	source: string,
	target: R4StudioNodeRef,
	attribute: unknown
): R4StudioEditableProperty | null {
	if (!isRecord(attribute) || attribute.type !== 'Attribute' || typeof attribute.name !== 'string') return null;
	if (!hasOffsets(attribute)) return null;
	const name = attribute.name;
	const value = attribute.value;

	if (value === true) {
		return {
			target,
			name,
			value: true,
			anchor: {
				attribute: offsetRange(attribute),
				edit: offsetRange(attribute),
				expected: source.slice(attribute.start, attribute.end),
				syntax: 'boolean-shorthand'
			}
		};
	}

	if (Array.isArray(value) && value.length === 1 && isRecord(value[0]) && value[0].type === 'Text' && hasOffsets(value[0])) {
		const text = value[0];
		const quoteBefore = source[text.start - 1];
		const quoteAfter = source[text.end];
		if ((quoteBefore !== '"' && quoteBefore !== "'") || quoteAfter !== quoteBefore) return null;
		const decoded = typeof text.data === 'string' ? text.data : typeof text.raw === 'string' ? text.raw : null;
		if (decoded === null) return null;
		return {
			target,
			name,
			value: decoded,
			anchor: {
				attribute: offsetRange(attribute),
				edit: offsetRange(text),
				expected: source.slice(text.start, text.end),
				syntax: 'quoted-text',
				quote: quoteBefore
			}
		};
	}

	if (isRecord(value) && value.type === 'ExpressionTag' && isRecord(value.expression) && hasOffsets(value.expression)) {
		const staticValue = staticExpressionValue(value.expression);
		if (staticValue === null) return null;
		return {
			target,
			name,
			value: staticValue,
			anchor: {
				attribute: offsetRange(attribute),
				edit: offsetRange(value.expression),
				expected: source.slice(value.expression.start, value.expression.end),
				syntax: 'expression'
			}
		};
	}

	return null;
}

function staticExpressionValue(expression: AstRecord): number | boolean | null {
	if (expression.type === 'Literal') {
		if (typeof expression.value === 'boolean') return expression.value;
		if (typeof expression.value === 'number' && Number.isFinite(expression.value)) return expression.value;
		return null;
	}
	if (
		expression.type === 'UnaryExpression' &&
		expression.operator === '-' &&
		isRecord(expression.argument) &&
		expression.argument.type === 'Literal' &&
		typeof expression.argument.value === 'number' &&
		Number.isFinite(expression.argument.value)
	) {
		return -expression.argument.value;
	}
	return null;
}

function findComponentAtRange(source: string, start: number, end: number): AstRecord | null {
	let root: unknown;
	try {
		root = parse(source, { modern: true });
	} catch {
		return null;
	}
	const seen = new WeakSet<object>();
	const visit = (value: unknown): AstRecord | null => {
		if (Array.isArray(value)) {
			for (const item of value) {
				const found = visit(item);
				if (found) return found;
			}
			return null;
		}
		if (!isRecord(value) || seen.has(value)) return null;
		seen.add(value);
		if (value.type === 'Component' && value.start === start && value.end === end) return value;
		for (const child of Object.values(value)) {
			const found = visit(child);
			if (found) return found;
		}
		return null;
	};
	return visit(root);
}

function escapeAttributeText(value: string, quote: '"' | "'"): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('{', '&#123;')
		.replaceAll('}', '&#125;')
		.replaceAll(quote, quote === '"' ? '&quot;' : '&#39;');
}

function isStaticValue(value: unknown): value is R4StudioStaticPropertyValue {
	return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

function isRecord(value: unknown): value is AstRecord {
	return typeof value === 'object' && value !== null;
}

function hasOffsets(value: AstRecord): value is AstRecord & { start: number; end: number } {
	return Number.isInteger(value.start) && Number.isInteger(value.end);
}

function offsetRange(value: AstRecord & { start: number; end: number }): R4StudioOffsetRange {
	return { start: value.start, end: value.end };
}
