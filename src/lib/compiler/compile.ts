import { compile, parse, type AST } from 'svelte/compiler';
import { isPrimitiveName, primitiveManifest, type PrimitiveName } from '../manifest.js';
import {
	R4_IR_VERSION,
	type JsonValue,
	type R4CompileResult,
	type R4Diagnostic,
	type R4EachNode,
	type R4Effect,
	type R4ExpressionValue,
	type R4HandlerValue,
	type R4IfNode,
	type R4LiteralValue,
	type R4Mutation,
	type R4Node,
	type R4SemanticDocument,
	type R4StateBinding,
	type R4SyntaxNode,
	type R4TemplateValue,
	type R4UpdateEdge,
	type R4Value,
	type SourcePosition,
	type SourceRange
} from './ir.js';

type AstNode = {
	type: string;
	start?: number;
	end?: number;
	[key: string]: unknown;
};

type StateDraft = {
	name: string;
	kind: R4StateBinding['kind'];
	valueNode: AstNode | null;
	rangeNode: AstNode;
};

export interface CompileR4Options {
	filename?: string;
	primitiveModules?: string[];
}

type CompilerContext = {
	source: string;
	lineStarts: number[];
	filename: string;
	primitiveBindings: Map<string, PrimitiveName>;
	reactiveNames: Set<string>;
	bindingNames: Set<string>;
	templateLocals: Set<string>;
	functions: Map<string, AstNode>;
	diagnostics: R4Diagnostic[];
	requirements: Set<string>;
	nodeIndex: number;
};

const propNames: Partial<Record<PrimitiveName, Record<string, string>>> = {
	Button: { onclick: 'activation', disabled: 'disabled', variant: 'emphasis', label: 'accessibilityLabel' },
	Input: { oninput: 'change', label: 'label', description: 'description' },
	Link: { href: 'destination', external: 'external', label: 'accessibilityLabel' },
	Image: { alt: 'alternative', src: 'source' },
	Icon: { label: 'accessibilityLabel' },
	View: { onclick: 'activation', onkeydown: 'keyboardActivation', label: 'accessibilityLabel' },
	Scroll: { label: 'accessibilityLabel' },
	Text: { role: 'textRole' }
};

const handlerProps = new Set(['activation', 'keyboardActivation', 'change']);
const allPlatforms = ['web', 'ios', 'android', 'macos', 'windows'] as const;
const portableGlobals = new Set([
	'Array',
	'Boolean',
	'Infinity',
	'JSON',
	'Math',
	'NaN',
	'Number',
	'Object',
	'String',
	'undefined'
]);

export function compileR4(source: string, options: CompileR4Options = {}): R4CompileResult {
	const filename = options.filename ?? 'Component.svelte';
	const diagnostics: R4Diagnostic[] = [];
	let runes = false;

	try {
		const validation = compile(source, { filename, generate: false, modernAst: true });
		runes = validation.metadata.runes;
		for (const warning of validation.warnings) {
			diagnostics.push({
				code: `svelte/${warning.code}`,
				severity: 'warning',
				message: warning.message,
				range: compilerRange(warning.start, warning.end)
			});
		}
	} catch (error) {
		const diagnostic = error as {
			code?: string;
			message?: string;
			start?: { line: number; column: number; character?: number };
			end?: { line: number; column: number; character?: number };
		};
		diagnostics.push({
			code: `svelte/${diagnostic.code ?? 'compile-error'}`,
			severity: 'error',
			message: diagnostic.message ?? String(error),
			range: compilerRange(diagnostic.start, diagnostic.end)
		});
		return { ir: null, diagnostics, ast: null };
	}

	let ast: AST.Root;
	try {
		ast = parse(source, { filename, modern: true });
	} catch (error) {
		diagnostics.push({
			code: 'r4/parse-error',
			severity: 'error',
			message: error instanceof Error ? error.message : String(error)
		});
		return { ir: null, diagnostics, ast: null };
	}

	const context: CompilerContext = {
		source,
		lineStarts: getLineStarts(source),
		filename,
		primitiveBindings: new Map(),
		reactiveNames: new Set(),
		bindingNames: new Set(),
		templateLocals: new Set(),
		functions: new Map(),
		diagnostics,
		requirements: new Set(),
		nodeIndex: 0
	};

	const primitiveModules = new Set(options.primitiveModules ?? ['r4', '$lib', '$lib/index.js']);
	const stateDrafts = collectScript(ast, primitiveModules, context);
	for (const draft of stateDrafts) context.bindingNames.add(draft.name);
	const state = stateDrafts.map((draft) => stateFromDraft(draft, context));
	const effects = collectEffects(ast, context);
	const root = compileFragment(ast.fragment, context);

	if (ast.css) {
		diagnostics.push({
			code: 'r4/component-style',
			severity: 'warning',
			message: 'Component-scoped CSS is web-specific and is not projected into portable R4 backends.',
			range: range(ast.css as unknown as AstNode, context),
			suggestion: 'Express portable layout and design through primitive props and tokens.'
		});
	}

	const document: R4SemanticDocument = {
		schema: 'r4.semantic',
		version: R4_IR_VERSION,
		source: { filename, runes },
		state,
		effects,
		updates: collectUpdates(state, effects, root),
		root,
		requirements: [...context.requirements].sort()
	};

	return {
		ir: document,
		diagnostics,
		ast: syntaxOutline(ast as unknown as AstNode, context)
	};
}

function collectUpdates(state: R4StateBinding[], effects: R4Effect[], root: R4Node[]): R4UpdateEdge[] {
	const updates: R4UpdateEdge[] = [];
	for (const binding of state) {
		if (binding.kind !== 'derived') continue;
		for (const dependency of binding.dependencies) updates.push({ from: dependency, to: binding.name, kind: 'recompute' });
	}
	for (const effect of effects) {
		for (const dependency of effect.dependencies) updates.push({ from: dependency, to: effect.id, kind: 'effect' });
	}

	function visitNodes(nodes: R4Node[]) {
		for (const node of nodes) {
			if (node.kind === 'text') {
				for (const dependency of node.dependencies) updates.push({ from: dependency, to: node.id, kind: 'text' });
				continue;
			}
			if (node.kind === 'if') {
				for (const dependency of node.test.dependencies) updates.push({ from: dependency, to: node.id, kind: 'structure' });
				visitNodes(node.consequent);
				visitNodes(node.alternate);
				continue;
			}
			if (node.kind === 'each') {
				for (const dependency of node.collection.dependencies) updates.push({ from: dependency, to: node.id, kind: 'structure' });
				visitNodes(node.children);
				visitNodes(node.fallback);
				continue;
			}
			for (const [property, value] of Object.entries(node.props)) {
				if (value.kind === 'handler' || value.kind === 'literal') continue;
				for (const dependency of value.dependencies) updates.push({ from: dependency, to: `${node.id}.${property}`, kind: 'property' });
			}
			visitNodes(node.children);
		}
	}

	visitNodes(root);
	return updates;
}

function collectScript(ast: AST.Root, primitiveModules: Set<string>, context: CompilerContext): StateDraft[] {
	const drafts: StateDraft[] = [];
	const program = ast.instance?.content as unknown as AstNode | undefined;
	if (!program) return drafts;

	const body = nodeArray(program.body);
	for (const statement of body) {
		if (statement.type === 'ImportDeclaration') {
			const source = literalValue(statement.source);
			if (typeof source !== 'string' || !primitiveModules.has(source)) continue;

			for (const specifier of nodeArray(statement.specifiers)) {
				if (specifier.type !== 'ImportSpecifier') continue;
				const imported = identifierName(specifier.imported);
				const local = identifierName(specifier.local);
				if (imported && local && isPrimitiveName(imported)) context.primitiveBindings.set(local, imported);
			}
			continue;
		}

		if (statement.type === 'FunctionDeclaration') {
			const name = identifierName(statement.id);
			if (name) context.functions.set(name, statement);
			continue;
		}

		if (statement.type !== 'VariableDeclaration') continue;
		for (const declaration of nodeArray(statement.declarations)) {
			const init = asNode(declaration.init);
			const id = asNode(declaration.id);
			if (!id) continue;

			if (id.type === 'Identifier') {
				const name = identifierName(id);
				if (!name) continue;
				const rune = callName(init);
				if (rune === '$state' || rune === '$derived') {
					const valueNode = nodeArray(init?.arguments)[0] ?? null;
					const kind = rune === '$state' ? 'state' : 'derived';
					drafts.push({ name, kind, valueNode, rangeNode: declaration });
					context.reactiveNames.add(name);
				} else if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
					context.functions.set(name, init);
				} else if (rune?.startsWith('$state.') || rune?.startsWith('$derived.')) {
					context.diagnostics.push({
						code: 'r4/unsupported-rune',
						severity: 'error',
						message: `${rune} is not part of the v0.1 portable rune subset.`,
						range: range(init ?? declaration, context),
						suggestion: 'Use $state(initialValue) or $derived(expression).'
					});
				} else if (statement.kind === 'const' && init) {
					drafts.push({ name, kind: 'constant', valueNode: init, rangeNode: declaration });
				}
				continue;
			}

			if (id.type === 'ObjectPattern' && callName(init) === '$props') {
				for (const property of nodeArray(id.properties)) {
					if (property.type !== 'Property') continue;
					const value = asNode(property.value);
					const name = value?.type === 'AssignmentPattern' ? identifierName(value.left) : identifierName(value);
					const defaultValue = value?.type === 'AssignmentPattern' ? asNode(value.right) : null;
					if (!name) continue;
					drafts.push({ name, kind: 'prop', valueNode: defaultValue, rangeNode: property });
					context.reactiveNames.add(name);
				}
			}
		}
	}

	return drafts;
}

function stateFromDraft(draft: StateDraft, context: CompilerContext): R4StateBinding {
	const fallback: R4ExpressionValue = { kind: 'expression', source: 'undefined', dependencies: [], references: [] };
	const value = draft.valueNode ? expressionValue(draft.valueNode, context) : fallback;
	return {
		name: draft.name,
		kind: draft.kind,
		value,
		dependencies: dependenciesOf(value),
		range: range(draft.rangeNode, context)
	};
}

function collectEffects(ast: AST.Root, context: CompilerContext): R4Effect[] {
	const program = ast.instance?.content as unknown as AstNode | undefined;
	if (!program) return [];
	const effects: R4Effect[] = [];

	for (const statement of nodeArray(program.body)) {
		if (statement.type !== 'ExpressionStatement') continue;
		const expression = asNode(statement.expression);
		const rune = callName(expression);
		if (rune?.startsWith('$effect.')) {
			context.diagnostics.push({
				code: 'r4/unsupported-rune',
				severity: 'error',
				message: `${rune} is not part of the v0.1 portable rune subset.`,
				range: range(expression ?? statement, context),
				suggestion: 'Use $effect(() => { ... }) for dependency analysis.'
			});
			continue;
		}
		if (rune !== '$effect') continue;
		const implementation = nodeArray(expression?.arguments)[0];
		if (!implementation) continue;
		effects.push({
			id: nextId('effect', context),
			source: sourceFor(implementation, context),
			dependencies: collectReferences(implementation).filter((reference) => context.reactiveNames.has(reference)),
			range: range(statement, context)
		});
	}

	return effects;
}

function compileFragment(fragment: AST.Fragment, context: CompilerContext): R4Node[] {
	const result: R4Node[] = [];
	let textParts: Array<R4LiteralValue | R4ExpressionValue> = [];
	let textStart: AstNode | null = null;
	let textEnd: AstNode | null = null;

	function flushText() {
		if (textParts.length === 0 || !textStart || !textEnd) return;
		result.push({
			kind: 'text',
			id: nextId('text', context),
			parts: textParts,
			dependencies: unique(textParts.flatMap((part) => (part.kind === 'expression' ? part.dependencies : []))),
			range: rangeBetween(textStart, textEnd, context)
		});
		textParts = [];
		textStart = null;
		textEnd = null;
	}

	for (const rawNode of fragment.nodes) {
		const node = rawNode as unknown as AstNode;
		if (node.type === 'Text') {
			const value = typeof node.data === 'string' ? node.data : '';
			if (value.trim() === '') continue;
			textStart ??= node;
			textEnd = node;
			textParts.push({ kind: 'literal', value });
			continue;
		}

		if (node.type === 'ExpressionTag') {
			const expression = asNode(node.expression);
			if (!expression) continue;
			textStart ??= node;
			textEnd = node;
			const value = expressionValue(expression, context);
			textParts.push(value.kind === 'literal' ? value : toExpressionPart(value, expression, context));
			continue;
		}

		flushText();
		if (node.type === 'Comment') continue;
		if (node.type === 'Component') {
			const element = compileComponent(node, context);
			if (element) result.push(element);
			continue;
		}
		if (node.type === 'IfBlock') {
			result.push(compileIf(node, context));
			continue;
		}
		if (node.type === 'EachBlock') {
			result.push(compileEach(node, context));
			continue;
		}

		context.diagnostics.push({
			code: node.type === 'RegularElement' ? 'r4/platform-element' : 'r4/unsupported-template-node',
			severity: 'error',
			message:
				node.type === 'RegularElement'
					? `Native element <${String(node.name)}> has no portable R4 meaning.`
					: `${node.type} is not part of the v0.1 portable Svelte subset.`,
			range: range(node, context),
			suggestion: node.type === 'RegularElement' ? 'Use an R4 semantic primitive.' : undefined
		});
	}

	flushText();
	return result;
}

function compileComponent(node: AstNode, context: CompilerContext): R4Node | null {
	const localName = typeof node.name === 'string' ? node.name : '';
	const primitive = context.primitiveBindings.get(localName);
	if (!primitive) {
		context.diagnostics.push({
			code: 'r4/unknown-component',
			severity: 'error',
			message: `<${localName}> is not a recognized R4 primitive import.`,
			range: range(node, context),
			suggestion: 'Import semantic primitives from r4 or $lib.'
		});
		return null;
	}

	const definition = primitiveManifest[primitive];
	const props: Record<string, R4Value> = {};
	const originalProps = new Set<string>();
	for (const attribute of nodeArray(node.attributes)) {
		if (attribute.type === 'Attribute') {
			const originalName = typeof attribute.name === 'string' ? attribute.name : '';
			const semanticName = propNames[primitive]?.[originalName] ?? originalName;
			originalProps.add(originalName);
			props[semanticName] = attributeValue(attribute, context, handlerProps.has(semanticName) || originalName.startsWith('on'));
			continue;
		}

		if (attribute.type === 'OnDirective') {
			const eventName = typeof attribute.name === 'string' ? attribute.name : 'event';
			const semanticName = eventName === 'click' ? 'activation' : eventName;
			const expression = asNode(attribute.expression);
			if (expression) props[semanticName] = handlerValue(expression, context);
			context.diagnostics.push({
				code: 'r4/legacy-event-directive',
				severity: 'warning',
				message: `on:${eventName} is accepted for analysis but Svelte 5 event properties are preferred.`,
				range: range(attribute, context)
			});
			continue;
		}

		context.diagnostics.push({
			code: 'r4/unsupported-attribute',
			severity: 'error',
			message: `${attribute.type} cannot currently be represented in R4 Semantic IR.`,
			range: range(attribute, context)
		});
	}

	const fragment = node.fragment as AST.Fragment;
	const children = fragment ? compileFragment(fragment, context) : [];
	applySemanticDiagnostics(primitive, props, originalProps, children, node, context);
	collectRequirement(primitive, context);

	return {
		kind: 'element',
		id: nextId(primitive.toLowerCase(), context),
		primitive,
		domain: definition.domain,
		intent: definition.intent,
		props,
		children,
		range: range(node, context)
	};
}

function compileIf(node: AstNode, context: CompilerContext): R4IfNode {
	const testNode = asNode(node.test);
	const test = testNode
		? forceExpression(testNode, context)
		: { kind: 'expression' as const, source: 'false', dependencies: [], references: [] };
	return {
		kind: 'if',
		id: nextId('if', context),
		test,
		consequent: compileFragment(node.consequent as AST.Fragment, context),
		alternate: node.alternate ? compileFragment(node.alternate as AST.Fragment, context) : [],
		range: range(node, context)
	};
}

function compileEach(node: AstNode, context: CompilerContext): R4EachNode {
	const expression = asNode(node.expression);
	const item = patternName(asNode(node.context)) ?? 'item';
	const index = typeof node.index === 'string' ? node.index : undefined;
	context.diagnostics.push({
		code: 'r4/experimental-each',
		severity: 'info',
		message: 'Each blocks are represented in IR, but backend support is still experimental.',
		range: range(node, context)
	});
	const previousLocals = context.templateLocals;
	context.templateLocals = new Set([...previousLocals, item, ...(index ? [index] : [])]);
	const children = compileFragment(node.body as AST.Fragment, context);
	context.templateLocals = previousLocals;

	return {
		kind: 'each',
		id: nextId('each', context),
		collection: expression
			? forceExpression(expression, context)
			: { kind: 'expression', source: '[]', dependencies: [], references: [] },
		item,
		index,
		children,
		fallback: node.fallback ? compileFragment(node.fallback as AST.Fragment, context) : [],
		range: range(node, context)
	};
}

function applySemanticDiagnostics(
	primitive: PrimitiveName,
	props: Record<string, R4Value>,
	originalProps: Set<string>,
	children: R4Node[],
	node: AstNode,
	context: CompilerContext
) {
	if (primitive === 'View' && props.activation) {
		context.diagnostics.push({
			code: 'r4/interactive-view',
			severity: 'warning',
			message: 'Interactive View has pointer activation, but its semantic action intent cannot be inferred reliably.',
			range: range(node, context),
			platforms: [...allPlatforms],
			suggestion: 'Use Button for an action or Link for navigation.'
		});
	}

	if ([...originalProps].some((name) => name === 'onmouseenter' || name === 'onmouseover')) {
		context.diagnostics.push({
			code: 'r4/hover-dependent-interaction',
			severity: 'warning',
			message: 'Hover-dependent interaction is unavailable on touch-only input paths.',
			range: range(node, context),
			platforms: ['ios', 'android'],
			suggestion: 'Provide an equivalent activation or focus interaction.'
		});
	}

	if (primitive === 'Image' && !props.alternative) {
		context.diagnostics.push({
			code: 'r4/image-alternative-required',
			severity: 'error',
			message: 'Image requires alternative text. Use an empty string only for decorative imagery.',
			range: range(node, context),
			platforms: [...allPlatforms]
		});
	}

	if (primitive === 'Input' && !hasSemanticName(props.label)) {
		context.diagnostics.push({
			code: 'r4/input-label-required',
			severity: 'error',
			message: 'Input requires a semantic label.',
			range: range(node, context),
			platforms: [...allPlatforms]
		});
	}

	if (primitive === 'Button' && !hasSemanticName(props.accessibilityLabel) && !hasAccessibleText(children)) {
		context.diagnostics.push({
			code: 'r4/action-name-required',
			severity: 'error',
			message: 'Button requires content or an accessibility label.',
			range: range(node, context),
			platforms: [...allPlatforms]
		});
	}
}

function hasSemanticName(value: R4Value | undefined): boolean {
	if (!value || value.kind === 'handler') return false;
	if (value.kind === 'literal') return typeof value.value === 'string' && value.value.trim().length > 0;
	if (value.kind === 'expression') return true;
	return value.parts.some((part) => part.kind === 'expression' || (typeof part.value === 'string' && part.value.trim().length > 0));
}

function hasAccessibleText(nodes: R4Node[]): boolean {
	for (const node of nodes) {
		if (node.kind === 'text') {
			if (node.parts.some((part) => part.kind === 'expression' || (typeof part.value === 'string' && part.value.trim().length > 0))) return true;
			continue;
		}
		if (node.kind === 'element') {
			if (hasSemanticName(node.props.accessibilityLabel) || hasAccessibleText(node.children)) return true;
			continue;
		}
		if (node.kind === 'if') {
			if (hasAccessibleText(node.consequent) || hasAccessibleText(node.alternate)) return true;
			continue;
		}
		if (hasAccessibleText(node.children) || hasAccessibleText(node.fallback)) return true;
	}
	return false;
}

function collectRequirement(primitive: PrimitiveName, context: CompilerContext) {
	if (primitive === 'Input') context.requirements.add('text-input');
	if (primitive === 'Image') context.requirements.add('image-loading');
	if (primitive === 'Link') context.requirements.add('navigation');
}

function attributeValue(attribute: AstNode, context: CompilerContext, handler: boolean): R4Value {
	if (attribute.value === true) return { kind: 'literal', value: true };
	const direct = asNode(attribute.value);
	if (direct?.type === 'ExpressionTag') {
		const expression = asNode(direct.expression);
		if (!expression) return { kind: 'literal', value: null };
		return handler ? handlerValue(expression, context) : expressionValue(expression, context);
	}

	const parts = Array.isArray(attribute.value) ? attribute.value.map(asNode).filter(isPresent) : [];
	if (parts.every((part) => part.type === 'Text')) {
		return { kind: 'literal', value: parts.map((part) => String(part.data ?? '')).join('') };
	}

	const templateParts: R4TemplateValue['parts'] = [];
	for (const part of parts) {
		if (part.type === 'Text') {
			templateParts.push({ kind: 'literal', value: String(part.data ?? '') });
		} else if (part.type === 'ExpressionTag') {
			const expression = asNode(part.expression);
			if (expression) templateParts.push(toExpressionPart(expressionValue(expression, context), expression, context));
		}
	}
	return {
		kind: 'template',
		parts: templateParts,
		dependencies: unique(templateParts.flatMap((part) => (part.kind === 'expression' ? part.dependencies : [])))
	};
}

function expressionValue(node: AstNode, context: CompilerContext): R4Value {
	const staticValue = evaluateStatic(node);
	if (staticValue.ok) return { kind: 'literal', value: staticValue.value };
	return forceExpression(node, context);
}

function forceExpression(node: AstNode, context: CompilerContext): R4ExpressionValue {
	const references = collectReferences(node);
	for (const reference of references) {
		if (context.bindingNames.has(reference) || context.templateLocals.has(reference) || portableGlobals.has(reference)) continue;
		context.diagnostics.push({
			code: 'r4/unresolved-expression-reference',
			severity: 'error',
			message: `${reference} is not available to portable backends in this expression.`,
			range: range(node, context),
			suggestion: 'Use R4 state, props, constants, template locals, or a supported JavaScript global.'
		});
	}
	return {
		kind: 'expression',
		source: sourceFor(node, context),
		dependencies: references.filter((reference) => context.reactiveNames.has(reference)),
		references
	};
}

function toExpressionPart(value: R4Value, node: AstNode, context: CompilerContext): R4ExpressionValue {
	if (value.kind === 'expression') return value;
	if (value.kind === 'literal') {
		return { kind: 'expression', source: JSON.stringify(value.value), dependencies: [], references: [] };
	}
	return forceExpression(node, context);
}

function handlerValue(node: AstNode, context: CompilerContext): R4HandlerValue {
	const name = identifierName(node);
	const implementation = name ? context.functions.get(name) : undefined;
	const analysisNode = implementation ?? node;
	const mutations = collectMutations(analysisNode, context);
	const references = collectReferences(analysisNode);
	return {
		kind: 'handler',
		source: sourceFor(node, context),
		implementation: implementation ? sourceFor(implementation, context) : undefined,
		parameters: functionParameters(analysisNode),
		reads: references.filter((reference) => context.reactiveNames.has(reference)),
		writes: unique(mutations.map((mutation) => mutation.target)),
		mutations
	};
}

function collectMutations(node: AstNode, context: CompilerContext): R4Mutation[] {
	const mutations: R4Mutation[] = [];
	let unsupported = false;
	const locals = new Set(functionParameters(node));
	const body = isFunction(node) ? asNode(node.body) : node;
	if (!body) return mutations;

	const statements = body.type === 'BlockStatement' ? nodeArray(body.body) : [];
	for (const statement of statements) {
		if (statement.type === 'VariableDeclaration') {
			for (const declaration of nodeArray(statement.declarations)) collectPatternNames(asNode(declaration.id), locals);
		}
		if (statement.type === 'FunctionDeclaration') {
			const name = identifierName(statement.id);
			if (name) locals.add(name);
		}
	}

	const expressions = body.type === 'BlockStatement' ? statements : [body];
	for (const statement of expressions) {
		if (statement.type === 'EmptyStatement') continue;
		const expression = statement.type === 'ExpressionStatement' ? asNode(statement.expression) : statement;
		const mutation = expression ? mutationFromExpression(expression, locals, context) : null;
		if (mutation) {
			mutations.push(mutation);
			continue;
		}
		context.diagnostics.push({
			code: 'r4/unsupported-handler-control-flow',
			severity: 'error',
			message: `${statement.type} cannot be replayed safely by portable backends.`,
			range: range(statement, context),
			suggestion: 'Use a straight-line assignment or update of one R4 state binding.'
		});
		unsupported = true;
	}
	if (unsupported) return [];
	if (mutations.length > 1) {
		context.diagnostics.push({
			code: 'r4/multiple-handler-mutations',
			severity: 'error',
			message: 'Multiple state mutations cannot preserve sequential JavaScript semantics in the v0.1 portable subset.',
			range: range(node, context),
			suggestion: 'Express the handler as one state assignment or update.'
		});
		return [];
	}
	return mutations;
}

function mutationFromExpression(node: AstNode, locals: Set<string>, context: CompilerContext): R4Mutation | null {
	if (node.type === 'UpdateExpression') {
		const target = identifierName(node.argument);
		if (!target || locals.has(target) || !context.reactiveNames.has(target)) return null;
		return { target, operator: node.operator === '++' ? 'increment' : 'decrement' };
	}

	if (node.type !== 'AssignmentExpression') return null;
	const target = identifierName(node.left);
	if (!target || locals.has(target) || !context.reactiveNames.has(target)) return null;
	const operators: Record<string, R4Mutation['operator']> = {
		'=': 'assign',
		'+=': 'add',
		'-=': 'subtract',
		'*=': 'multiply',
		'/=': 'divide'
	};
	const operator = operators[String(node.operator)];
	if (!operator) return null;
	const valueNode = asNode(node.right);
	return { target, operator, value: valueNode ? expressionValue(valueNode, context) : undefined };
}

function collectReferences(node: AstNode): string[] {
	const references = new Set<string>();

	function walk(current: AstNode, parent: AstNode | null, key: string | null, scopes: Set<string>[]) {
		if (current.type === 'Identifier') {
			const name = String(current.name);
			if (isReferenceIdentifier(parent, key) && !scopes.some((scope) => scope.has(name))) references.add(name);
			return;
		}

		if (isFunction(current)) {
			const scope = new Set<string>();
			for (const parameter of nodeArray(current.params)) collectPatternNames(parameter, scope);
			const functionName = identifierName(current.id);
			if (functionName) scope.add(functionName);
			const body = asNode(current.body);
			if (body) walk(body, current, 'body', [...scopes, scope]);
			return;
		}

		if (current.type === 'BlockStatement') {
			const scope = new Set<string>();
			for (const statement of nodeArray(current.body)) {
				if (statement.type === 'VariableDeclaration') {
					for (const declaration of nodeArray(statement.declarations)) collectPatternNames(asNode(declaration.id), scope);
				}
				if (statement.type === 'FunctionDeclaration') {
					const name = identifierName(statement.id);
					if (name) scope.add(name);
				}
			}
			for (const statement of nodeArray(current.body)) walk(statement, current, 'body', [...scopes, scope]);
			return;
		}

		if (current.type === 'VariableDeclarator') {
			const init = asNode(current.init);
			if (init) walk(init, current, 'init', scopes);
			return;
		}

		for (const [childKey, value] of Object.entries(current)) {
			if (['loc', 'name_loc'].includes(childKey)) continue;
			if (isNode(value)) walk(value, current, childKey, scopes);
			if (Array.isArray(value)) for (const child of value) if (isNode(child)) walk(child, current, childKey, scopes);
		}
	}

	walk(node, null, null, []);
	return [...references].sort();
}

function isReferenceIdentifier(parent: AstNode | null, key: string | null): boolean {
	if (!parent || !key) return true;
	if ((parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') && key === 'property' && parent.computed !== true) return false;
	if ((parent.type === 'Property' || parent.type === 'MethodDefinition') && key === 'key' && parent.computed !== true) return false;
	if (['VariableDeclarator', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(parent.type) && (key === 'id' || key === 'params')) return false;
	if (parent.type === 'AssignmentExpression' && key === 'left' && parent.operator === '=') return false;
	if (['LabeledStatement', 'BreakStatement', 'ContinueStatement'].includes(parent.type) && key === 'label') return false;
	if ((parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression') && key === 'id') return false;
	if (parent.type === 'CatchClause' && key === 'param') return false;
	if (parent.type.startsWith('Import')) return false;
	return true;
}

function evaluateStatic(node: AstNode): { ok: true; value: JsonValue } | { ok: false } {
	if (node.type === 'Literal') {
		const value = node.value;
		if (value === null || typeof value === 'string' || typeof value === 'boolean') return { ok: true, value };
		if (typeof value === 'number' && Number.isFinite(value)) return { ok: true, value };
	}

	if (node.type === 'UnaryExpression') {
		const argument = asNode(node.argument);
		if (!argument) return { ok: false };
		const evaluated = evaluateStatic(argument);
		if (!evaluated.ok) return evaluated;
		if (node.operator === '!' && typeof evaluated.value === 'boolean') return { ok: true, value: !evaluated.value };
		if (node.operator === '-' && typeof evaluated.value === 'number') return { ok: true, value: -evaluated.value };
		if (node.operator === '+' && typeof evaluated.value === 'number') return { ok: true, value: evaluated.value };
	}

	if (node.type === 'ArrayExpression') {
		const elements = Array.isArray(node.elements) ? node.elements : [];
		if (elements.some((element) => !isNode(element))) return { ok: false };
		const values: JsonValue[] = [];
		for (const element of nodeArray(elements)) {
			const evaluated = evaluateStatic(element);
			if (!evaluated.ok) return evaluated;
			values.push(evaluated.value);
		}
		return { ok: true, value: values };
	}

	if (node.type === 'ObjectExpression') {
		const value: Record<string, JsonValue> = {};
		for (const property of nodeArray(node.properties)) {
			if (property.type !== 'Property' || property.computed === true) return { ok: false };
			const key = identifierName(property.key) ?? literalValue(property.key);
			const valueNode = asNode(property.value);
			if (typeof key !== 'string' || !valueNode) return { ok: false };
			const evaluated = evaluateStatic(valueNode);
			if (!evaluated.ok) return evaluated;
			value[key] = evaluated.value;
		}
		return { ok: true, value };
	}

	if (node.type === 'TemplateLiteral' && nodeArray(node.expressions).length === 0) {
		const quasi = nodeArray(node.quasis)[0];
		const quasiValue = quasi?.value;
		const cooked = typeof quasiValue === 'object' && quasiValue !== null ? (quasiValue as { cooked?: unknown }).cooked : undefined;
		if (typeof cooked === 'string') return { ok: true, value: cooked };
	}

	return { ok: false };
}

function syntaxOutline(node: AstNode, context: CompilerContext, depth = 0, seen = new WeakSet<object>()): R4SyntaxNode {
	const outlined: R4SyntaxNode = { type: node.type };
	if (typeof node.name === 'string') outlined.name = node.name;
	if (node.type === 'Identifier' && typeof node.name === 'string') outlined.name = node.name;
	if (
		node.type === 'Literal' &&
		(node.value === null || typeof node.value === 'string' || typeof node.value === 'boolean' || (typeof node.value === 'number' && Number.isFinite(node.value)))
	) {
		outlined.value = node.value as string | number | boolean | null;
	}
	if (typeof node.start === 'number' && typeof node.end === 'number') outlined.range = range(node, context);
	if (depth >= 10 || seen.has(node)) return outlined;
	seen.add(node);

	const children: R4SyntaxNode[] = [];
	for (const [key, value] of Object.entries(node)) {
		if (['type', 'start', 'end', 'loc', 'name_loc', 'name', 'value', 'raw', 'data'].includes(key)) continue;
		if (isNode(value)) children.push(syntaxOutline(value, context, depth + 1, seen));
		if (Array.isArray(value)) {
			for (const child of value) if (isNode(child)) children.push(syntaxOutline(child, context, depth + 1, seen));
		}
	}
	if (children.length > 0) outlined.children = children;
	return outlined;
}

function visit(node: AstNode, callback: (node: AstNode, parent: AstNode | null, key: string | null) => void) {
	function walk(current: AstNode, parent: AstNode | null, key: string | null) {
		callback(current, parent, key);
		for (const [childKey, value] of Object.entries(current)) {
			if (['loc', 'name_loc'].includes(childKey)) continue;
			if (isNode(value)) walk(value, current, childKey);
			if (Array.isArray(value)) for (const child of value) if (isNode(child)) walk(child, current, childKey);
		}
	}
	walk(node, null, null);
}

function dependenciesOf(value: R4Value): string[] {
	if (value.kind === 'expression' || value.kind === 'template') return value.dependencies;
	if (value.kind === 'handler') return value.reads;
	return [];
}

function sourceFor(node: AstNode, context: CompilerContext): string {
	if (typeof node.start !== 'number' || typeof node.end !== 'number') return '';
	return context.source.slice(node.start, node.end);
}

function range(node: AstNode, context: CompilerContext): SourceRange {
	return {
		start: position(node.start ?? 0, context),
		end: position(node.end ?? node.start ?? 0, context)
	};
}

function rangeBetween(start: AstNode, end: AstNode, context: CompilerContext): SourceRange {
	return { start: position(start.start ?? 0, context), end: position(end.end ?? end.start ?? 0, context) };
}

function position(offset: number, context: CompilerContext): SourcePosition {
	let low = 0;
	let high = context.lineStarts.length;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (context.lineStarts[middle] <= offset) low = middle + 1;
		else high = middle;
	}
	const lineIndex = Math.max(0, low - 1);
	return { line: lineIndex + 1, column: offset - context.lineStarts[lineIndex], offset };
}

function compilerRange(
	start?: { line: number; column: number; character?: number },
	end?: { line: number; column: number; character?: number }
): SourceRange | undefined {
	if (!start || !end) return undefined;
	return {
		start: { line: start.line, column: start.column, offset: start.character ?? 0 },
		end: { line: end.line, column: end.column, offset: end.character ?? start.character ?? 0 }
	};
}

function getLineStarts(source: string): number[] {
	const starts = [0];
	for (let index = 0; index < source.length; index += 1) if (source[index] === '\n') starts.push(index + 1);
	return starts;
}

function nextId(prefix: string, context: CompilerContext): string {
	context.nodeIndex += 1;
	return `${prefix}-${context.nodeIndex}`;
}

function patternName(node: AstNode | null): string | null {
	if (!node) return null;
	if (node.type === 'Identifier') return identifierName(node);
	return null;
}

function callName(node: AstNode | null): string | null {
	if (node?.type !== 'CallExpression') return null;
	const callee = asNode(node.callee);
	const direct = identifierName(callee);
	if (direct) return direct;
	if (callee?.type !== 'MemberExpression' || callee.computed === true) return null;
	const object = identifierName(callee.object);
	const property = identifierName(callee.property);
	return object && property ? `${object}.${property}` : null;
}

function isFunction(node: AstNode): boolean {
	return ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type);
}

function functionParameters(node: AstNode): string[] {
	if (!isFunction(node)) return [];
	const names = new Set<string>();
	for (const parameter of nodeArray(node.params)) collectPatternNames(parameter, names);
	return [...names];
}

function collectPatternNames(node: AstNode | null, names: Set<string>) {
	if (!node) return;
	if (node.type === 'Identifier') {
		const name = identifierName(node);
		if (name) names.add(name);
		return;
	}
	if (node.type === 'RestElement') {
		collectPatternNames(asNode(node.argument), names);
		return;
	}
	if (node.type === 'AssignmentPattern') {
		collectPatternNames(asNode(node.left), names);
		return;
	}
	if (node.type === 'ArrayPattern') {
		for (const element of nodeArray(node.elements)) collectPatternNames(element, names);
		return;
	}
	if (node.type === 'ObjectPattern') {
		for (const property of nodeArray(node.properties)) {
			collectPatternNames(property.type === 'RestElement' ? asNode(property.argument) : asNode(property.value), names);
		}
	}
}

function identifierName(value: unknown): string | null {
	const node = asNode(value);
	return node?.type === 'Identifier' && typeof node.name === 'string' ? node.name : null;
}

function literalValue(value: unknown): unknown {
	const node = asNode(value);
	return node?.type === 'Literal' ? node.value : undefined;
}

function nodeArray(value: unknown): AstNode[] {
	return Array.isArray(value) ? value.filter(isNode) : [];
}

function asNode(value: unknown): AstNode | null {
	return isNode(value) ? value : null;
}

function isNode(value: unknown): value is AstNode {
	return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function isPresent<T>(value: T | null): value is T {
	return value !== null;
}

function unique(values: string[]): string[] {
	return [...new Set(values)].sort();
}
