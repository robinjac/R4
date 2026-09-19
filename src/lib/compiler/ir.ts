import type { PrimitiveName } from '../manifest.js';

export const R4_IR_VERSION = 1 as const;

export type R4Platform = 'web' | 'ios' | 'android' | 'macos' | 'windows';
export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface SourcePosition {
	line: number;
	column: number;
	offset: number;
}

export interface SourceRange {
	start: SourcePosition;
	end: SourcePosition;
}

export interface R4Diagnostic {
	code: string;
	severity: DiagnosticSeverity;
	message: string;
	range?: SourceRange;
	platforms?: R4Platform[];
	suggestion?: string;
}

export interface R4LiteralValue {
	kind: 'literal';
	value: JsonValue;
}

export interface R4ExpressionValue {
	kind: 'expression';
	source: string;
	dependencies: string[];
	references: string[];
}

export interface R4TemplateValue {
	kind: 'template';
	parts: Array<R4LiteralValue | R4ExpressionValue>;
	dependencies: string[];
}

export interface R4Mutation {
	target: string;
	operator: 'assign' | 'increment' | 'decrement' | 'add' | 'subtract' | 'multiply' | 'divide';
	value?: R4Value;
}

export interface R4HandlerValue {
	kind: 'handler';
	source: string;
	implementation?: string;
	parameters: string[];
	reads: string[];
	writes: string[];
	mutations: R4Mutation[];
}

export type R4Value = R4LiteralValue | R4ExpressionValue | R4TemplateValue | R4HandlerValue;

export interface R4ElementNode {
	kind: 'element';
	id: string;
	primitive: PrimitiveName;
	domain: 'structure' | 'layout' | 'content' | 'action' | 'input' | 'application' | 'navigation';
	intent: string;
	props: Record<string, R4Value>;
	children: R4Node[];
	range: SourceRange;
}

export interface R4TextNode {
	kind: 'text';
	id: string;
	parts: Array<R4LiteralValue | R4ExpressionValue>;
	dependencies: string[];
	range: SourceRange;
}

export interface R4IfNode {
	kind: 'if';
	id: string;
	test: R4ExpressionValue;
	consequent: R4Node[];
	alternate: R4Node[];
	range: SourceRange;
}

export interface R4EachNode {
	kind: 'each';
	id: string;
	collection: R4ExpressionValue;
	item: string;
	index?: string;
	children: R4Node[];
	fallback: R4Node[];
	range: SourceRange;
}

export type R4Node = R4ElementNode | R4TextNode | R4IfNode | R4EachNode;

export interface R4StateBinding {
	name: string;
	kind: 'state' | 'derived' | 'prop' | 'constant';
	value: R4Value;
	dependencies: string[];
	range: SourceRange;
}

export interface R4Effect {
	id: string;
	source: string;
	dependencies: string[];
	range: SourceRange;
}

export interface R4UpdateEdge {
	from: string;
	to: string;
	kind: 'recompute' | 'text' | 'property' | 'structure' | 'effect';
}

export interface R4SemanticDocument {
	schema: 'r4.semantic';
	version: typeof R4_IR_VERSION;
	source: {
		filename: string;
		runes: boolean;
	};
	state: R4StateBinding[];
	effects: R4Effect[];
	updates: R4UpdateEdge[];
	root: R4Node[];
	requirements: string[];
}

export interface R4SyntaxNode {
	type: string;
	name?: string;
	value?: string | number | boolean | null;
	range?: SourceRange;
	children?: R4SyntaxNode[];
}

export interface R4CompileResult {
	ir: R4SemanticDocument | null;
	diagnostics: R4Diagnostic[];
	ast: R4SyntaxNode | null;
}
