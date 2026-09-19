import type {
	JsonValue,
	R4Diagnostic,
	R4ElementNode,
	R4ExpressionValue,
	R4HandlerValue,
	R4Mutation,
	R4Node,
	R4SemanticDocument,
	R4StateBinding,
	R4TextNode,
	R4Value
} from '../compiler/index.js';
import type { PrimitiveName } from '../manifest.js';
import type { R4Backend, R4BackendArtifact } from './types.js';

const spacing: Record<string, string> = {
	none: '0px',
	'2xs': '4px',
	xs: '8px',
	sm: '12px',
	md: '18px',
	lg: '28px',
	xl: '44px',
	'2xl': '68px'
};

const radii: Record<string, string> = { none: '0px', sm: '6px', md: '12px', lg: '22px', full: '999px' };

const supportedProps: Record<PrimitiveName, Set<string>> = {
	View: new Set(['width', 'height', 'padding', 'background', 'rounded', 'bordered', 'accessibilityLabel', 'activation', 'keyboardActivation']),
	Stack: new Set(['direction', 'gap', 'align', 'distribute', 'wrap']),
	Grid: new Set(['columns', 'minColumnWidth', 'gap', 'align']),
	Layer: new Set(['align']),
	Text: new Set(['textRole', 'level', 'tone', 'align']),
	Image: new Set(['source', 'alternative', 'width', 'height', 'fit', 'loading']),
	Icon: new Set(['name', 'accessibilityLabel', 'size']),
	Button: new Set(['activation', 'disabled', 'emphasis', 'type', 'accessibilityLabel']),
	Input: new Set(['change', 'label', 'value', 'placeholder', 'type', 'disabled', 'description']),
	Page: new Set(['title', 'description', 'padding', 'background']),
	Scroll: new Set(['direction', 'accessibilityLabel']),
	Link: new Set(['destination', 'external', 'accessibilityLabel'])
};

const staticStyleProps: Partial<Record<PrimitiveName, string[]>> = {
	View: ['width', 'height', 'padding', 'background', 'rounded', 'bordered'],
	Stack: ['direction', 'gap', 'align', 'distribute', 'wrap'],
	Grid: ['columns', 'minColumnWidth', 'gap', 'align'],
	Layer: ['align'],
	Text: ['textRole', 'level', 'tone', 'align'],
	Image: ['width', 'height', 'fit'],
	Icon: ['size'],
	Button: ['emphasis'],
	Page: ['padding', 'background'],
	Scroll: ['direction']
};

type EmitContext = {
	diagnostics: R4Diagnostic[];
	handlers: Map<string, R4HandlerValue>;
	state: Map<string, R4StateBinding>;
};

export const lynxBackend: R4Backend = {
	id: 'lynx-react-adapter',
	lower: lowerToLynx
};

export function lowerToLynx(document: R4SemanticDocument): R4BackendArtifact {
	const context: EmitContext = {
		diagnostics: [],
		handlers: new Map(),
		state: new Map(document.state.map((binding) => [binding.name, binding]))
	};
	for (const effect of document.effects) {
		context.diagnostics.push({
			code: 'r4/lynx-effect-unsupported',
			severity: 'error',
			message: `Effect ${effect.id} cannot be lowered by the v0.1 Lynx adapter.`
		});
	}
	collectHandlers(document.root, context.handlers);

	const imports = document.state.some((binding) => binding.kind === 'state')
		? `import { root, useState } from '@lynx-js/react';`
		: `import { root } from '@lynx-js/react';`;
	const state = document.state.map((binding) => emitState(binding, context)).filter(Boolean).join('\n');
	const handlers = [...context.handlers.entries()].map(([id, handler]) => emitHandler(id, handler, context)).join('\n\n');
	const tree = document.root.map((node) => emitNode(node, context, 2)).join('\n');

	const source = `${imports}

// Generated from R4 Semantic IR. ReactLynx is an isolated backend detail.
function R4App() {
${indentBlock(state || '// No reactive declarations.', 1)}

${indentBlock(handlers || '// No action handlers.', 1)}

\treturn (
\t\t<page style={{ width: '100%', height: '100%', backgroundColor: '#f3f0e8' }}>
${tree || '\t\t\t<view />'}
\t\t</page>
\t);
}

root.render(<R4App />);

if (import.meta.webpackHot) {
\timport.meta.webpackHot.accept();
}
`;

	return {
		backend: 'lynx-react-adapter',
		target: 'lynx',
		status: 'experimental',
		entry: 'src/generated.tsx',
		files: { 'src/generated.tsx': source },
		requirements: unique(['lynx-engine>=3.9', '@lynx-js/react (backend only)', ...document.requirements.map(lynxRequirement)]),
		diagnostics: context.diagnostics
	};
}

function emitState(binding: R4StateBinding, context: EmitContext): string {
	const value = emitValue(binding.value);
	if (binding.kind === 'state') return `const [${binding.name}, ${setter(binding.name)}] = useState(${value});`;
	if (binding.kind === 'derived') return `const ${binding.name} = ${value};`;
	if (binding.kind === 'constant') return `const ${binding.name} = ${value};`;
	if (binding.kind === 'prop') {
		context.diagnostics.push({
			code: 'r4/lynx-root-prop-defaulted',
			severity: 'info',
			message: `Root prop ${binding.name} uses its compile-time default in the Lynx experiment.`
		});
		return `const ${binding.name} = ${value};`;
	}
	return '';
}

function emitHandler(id: string, handler: R4HandlerValue, context: EmitContext): string {
	const name = handlerName(id);
	const operations = handler.mutations.map((mutation) => emitMutation(mutation, context)).filter(Boolean);
	if (operations.length === 0) {
		context.diagnostics.push({
			code: 'r4/lynx-handler-not-lowered',
			severity: 'error',
			message: `Handler ${handler.source} has no mutation form supported by the v0.1 Lynx adapter.`
		});
		operations.push(`throw new Error('R4: action was not lowered by the Lynx research adapter');`);
	}
	return `const ${name} = () => {\n\t\t'background only';\n${operations.map((line) => `\t\t${line}`).join('\n')}\n\t};`;
}

function emitMutation(mutation: R4Mutation, context: EmitContext): string {
	const binding = context.state.get(mutation.target);
	if (!binding || binding.kind !== 'state') {
		context.diagnostics.push({
			code: 'r4/lynx-invalid-state-write',
			severity: 'error',
			message: `Cannot write to ${mutation.target}; it is not an R4 state binding.`
		});
		return '';
	}

	const set = setter(mutation.target);
	switch (mutation.operator) {
		case 'increment':
			return `${set}((value) => value + 1);`;
		case 'decrement':
			return `${set}((value) => value - 1);`;
		case 'assign':
			return `${set}(${mutation.value ? emitValue(mutation.value) : 'undefined'});`;
		case 'add':
			return `${set}((value) => value + (${mutation.value ? emitValue(mutation.value) : '0'}));`;
		case 'subtract':
			return `${set}((value) => value - (${mutation.value ? emitValue(mutation.value) : '0'}));`;
		case 'multiply':
			return `${set}((value) => value * (${mutation.value ? emitValue(mutation.value) : '1'}));`;
		case 'divide':
			return `${set}((value) => value / (${mutation.value ? emitValue(mutation.value) : '1'}));`;
	}
}

function emitNode(node: R4Node, context: EmitContext, depth: number, inheritedTextColor?: string): string {
	if (node.kind === 'text') return emitText(node, depth);
	if (node.kind === 'if') {
		const consequent = node.consequent.map((child) => emitNode(child, context, depth + 2, inheritedTextColor)).join('\n');
		const alternate = node.alternate.map((child) => emitNode(child, context, depth + 2, inheritedTextColor)).join('\n');
		return `${tabs(depth)}{${node.test.source} ? (\n${tabs(depth + 1)}<>\n${consequent}\n${tabs(depth + 1)}</>\n${tabs(depth)}) : (\n${tabs(depth + 1)}<>\n${alternate}\n${tabs(depth + 1)}</>\n${tabs(depth)})}`;
	}
	if (node.kind === 'each') {
		context.diagnostics.push({
			code: 'r4/lynx-each-unsupported',
			severity: 'error',
			message: `Each node ${node.id} cannot be lowered by the v0.1 Lynx adapter.`
		});
		return `${tabs(depth)}<view />`;
	}
	return emitElement(node, context, depth, inheritedTextColor);
}

function emitElement(node: R4ElementNode, context: EmitContext, depth: number, inheritedTextColor?: string): string {
	validateElement(node, context);
	const tag = lynxTag(node.primitive);
	const attributes = emitAttributes(node, context, inheritedTextColor);
	const childTextColor = node.primitive === 'Button' ? buttonTextColor(String(literal(node.props.emphasis) ?? 'primary')) : inheritedTextColor;
	const children = node.children.map((child) => emitNode(child, context, depth + 1, childTextColor)).join('\n');
	const indentation = tabs(depth);
	if (!children) return `${indentation}<${tag}${attributes} />`;
	return `${indentation}<${tag}${attributes}>\n${children}\n${indentation}</${tag}>`;
}

function emitText(node: R4TextNode, depth: number): string {
	const content = node.parts
		.map((part) => (part.kind === 'literal' ? `{${JSON.stringify(String(part.value ?? ''))}}` : `{${part.source}}`))
		.join('');
	return `${tabs(depth)}<text>${content}</text>`;
}

function emitAttributes(node: R4ElementNode, context: EmitContext, inheritedTextColor?: string): string {
	const attributes: string[] = [];
	const styles = stylesFor(node, inheritedTextColor);
	if (Object.keys(styles).length > 0) attributes.push(`style={${JSON.stringify(styles)}}`);

	const activation = node.props.activation;
	if (activation?.kind === 'handler') {
		context.handlers.set(node.id, activation);
		attributes.push(`bindtap={${handlerName(node.id)}}`);
	}

	if (node.primitive === 'Button') {
		attributes.push(`accessibility-element={true}`, `accessibility-traits="button"`);
		const label = node.props.accessibilityLabel ?? textContent(node.children);
		if (label) attributes.push(`accessibility-label={${emitValue(label)}}`);
		if (node.props.disabled) attributes.push(`user-interaction-enabled={!(${emitValue(node.props.disabled)})}`);
	}

	if (node.primitive === 'Image') {
		if (node.props.source) attributes.push(`src={${emitValue(node.props.source)}}`);
		if (literal(node.props.alternative) === '') {
			attributes.push(`accessibility-element={false}`);
		} else {
			if (node.props.alternative) attributes.push(`accessibility-label={${emitValue(node.props.alternative)}}`);
			attributes.push(`accessibility-element={true}`, `accessibility-traits="image"`);
		}
		const fit = literal(node.props.fit);
		if (typeof fit === 'string') {
			const modes: Record<string, string> = { cover: 'aspectFill', contain: 'aspectFit', fill: 'scaleToFill' };
			attributes.push(`mode=${JSON.stringify(modes[fit] ?? 'aspectFill')}`);
		}
	}

	if (node.primitive === 'Input') {
		for (const prop of ['placeholder', 'type', 'disabled'] as const) {
			if (node.props[prop]) attributes.push(`${prop}={${emitValue(node.props[prop])}}`);
		}
	}

	if (node.primitive === 'Scroll') {
		const direction = literal(node.props.direction) ?? 'vertical';
		attributes.push(`scroll-orientation=${JSON.stringify(direction)}`);
		if (node.props.accessibilityLabel) {
			attributes.push(`accessibility-element={true}`, `accessibility-label={${emitValue(node.props.accessibilityLabel)}}`);
		}
	}

	if (node.primitive === 'Text') {
		const role = literal(node.props.textRole);
		if (role === 'title' || role === 'heading' || node.props.level) {
			attributes.push(`accessibility-element={true}`, `accessibility-traits="header"`);
		}
	}

	if (node.primitive === 'Link') {
		attributes.push(`accessibility-element={true}`, `accessibility-traits="link"`);
		const label = node.props.accessibilityLabel ?? textContent(node.children);
		if (label) attributes.push(`accessibility-label={${emitValue(label)}}`);
		context.diagnostics.push({
			code: 'r4/lynx-navigation-host-required',
			severity: 'error',
			message: 'Link requires the future R4 Host navigation capability on Lynx.'
		});
	}

	return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
}

function validateElement(node: R4ElementNode, context: EmitContext) {
	for (const prop of Object.keys(node.props)) {
		if (supportedProps[node.primitive].has(prop)) continue;
		context.diagnostics.push({
			code: 'r4/lynx-prop-unsupported',
			severity: 'error',
			message: `${node.primitive}.${prop} has no v0.1 Lynx lowering.`
		});
	}

	for (const prop of staticStyleProps[node.primitive] ?? []) {
		const value = node.props[prop];
		if (!value || value.kind === 'literal') continue;
		context.diagnostics.push({
			code: 'r4/lynx-dynamic-style-unsupported',
			severity: 'error',
			message: `${node.primitive}.${prop} must be static for the v0.1 Lynx adapter.`
		});
	}

	const unsupported: Partial<Record<PrimitiveName, string>> = {
		Grid: 'Grid has no verified Lynx layout policy in the v0.1 adapter.',
		Layer: 'Layer overlap semantics are not implemented by the v0.1 Lynx adapter.',
		Icon: 'Icon assets are not implemented by the v0.1 Lynx adapter.',
		Input: 'Input value and change semantics are not implemented by the v0.1 Lynx adapter.'
	};
	const message = unsupported[node.primitive];
	if (message) context.diagnostics.push({ code: 'r4/lynx-primitive-unsupported', severity: 'error', message });

	if (node.primitive === 'View' && node.props.activation) {
		context.diagnostics.push({
			code: 'r4/lynx-interactive-view-unsupported',
			severity: 'error',
			message: 'Interactive View cannot be assigned reliable Lynx action semantics.'
		});
	}
	if (node.props.keyboardActivation) {
		context.diagnostics.push({
			code: 'r4/lynx-keyboard-handler-unsupported',
			severity: 'error',
			message: `${node.primitive}.keyboardActivation is not implemented by the v0.1 Lynx adapter.`
		});
	}
}

function stylesFor(node: R4ElementNode, inheritedTextColor?: string): Record<string, string | number> {
	const props = node.props;
	const styles: Record<string, string | number> = {};
	const gap = spacingValue(literal(props.gap));
	const padding = paddingValue(literal(props.padding));
	const width = sizeValue(literal(props.width));
	const height = sizeValue(literal(props.height));
	if (gap) styles.gap = gap;
	if (padding) styles.padding = padding;
	if (width) styles.width = width;
	if (height) styles.height = height;

	switch (node.primitive) {
		case 'Page': {
			styles.width = '100%';
			styles.minHeight = '100%';
			const background = backgroundValue(literal(props.background));
			if (background) styles.background = background;
			break;
		}
		case 'View': {
			const background = backgroundValue(literal(props.background));
			const rounded = radiusValue(literal(props.rounded));
			if (background) styles.background = background;
			if (rounded) styles.borderRadius = rounded;
			if (literal(props.bordered) === true) {
				styles.border = '1px solid #d9d5c9';
			}
			break;
		}
		case 'Stack': {
			styles.display = 'flex';
			styles.flexDirection = literal(props.direction) === 'horizontal' ? 'row' : 'column';
			styles.alignItems = alignmentValue(literal(props.align));
			styles.justifyContent = distributionValue(literal(props.distribute));
			styles.flexWrap = literal(props.wrap) === true ? 'wrap' : 'nowrap';
			break;
		}
		case 'Grid': {
			styles.display = 'grid';
			const columns = literal(props.columns) ?? 'adaptive';
			const min = literal(props.minColumnWidth) ?? 220;
			styles.gridTemplateColumns = columns === 'adaptive' ? `repeat(auto-fit, minmax(${min}px, 1fr))` : `repeat(${columns}, 1fr)`;
			styles.alignItems = alignmentValue(literal(props.align));
			break;
		}
		case 'Layer':
			styles.position = 'relative';
			break;
		case 'Text':
			Object.assign(styles, textStyles(String(literal(props.textRole) ?? 'body')));
			styles.color = props.tone ? toneColor(String(literal(props.tone))) : (inheritedTextColor ?? toneColor('default'));
			styles.textAlign = textAlignment(String(literal(props.align) ?? 'start'));
			break;
		case 'Button':
			Object.assign(styles, buttonStyles(String(literal(props.emphasis) ?? 'primary')));
			break;
		case 'Input':
			styles.minHeight = '44px';
			styles.padding = '12px';
			styles.border = '1px solid #a9a69d';
			styles.borderRadius = '6px';
			styles.backgroundColor = '#fffef9';
			break;
		case 'Scroll':
			styles.width = styles.width ?? '100%';
			styles.height = styles.height ?? '100%';
			break;
		case 'Link':
			styles.color = '#005bd7';
			break;
	}
	return styles;
}

function textStyles(role: string): Record<string, string> {
	if (role === 'title') return { fontSize: '42px', fontWeight: '700', lineHeight: '44px' };
	if (role === 'heading') return { fontSize: '24px', fontWeight: '600', lineHeight: '29px' };
	if (role === 'caption') return { fontSize: '12px', lineHeight: '17px', color: '#687078' };
	if (role === 'label') return { fontSize: '13px', fontWeight: '600', lineHeight: '17px' };
	return { fontSize: '16px', lineHeight: '24px', color: '#171b1e' };
}

function toneColor(tone: string): string {
	const colors: Record<string, string> = {
		default: '#171b1e',
		muted: '#656c70',
		accent: '#005bd7',
		danger: '#b42318',
		success: '#24623f'
	};
	return colors[tone] ?? colors.default;
}

function textAlignment(align: string): string {
	return align === 'start' ? 'left' : align === 'end' ? 'right' : align;
}

function buttonStyles(variant: string): Record<string, string> {
	const base = {
		minHeight: '44px',
		padding: '12px 18px',
		borderRadius: '12px',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center'
	};
	if (variant === 'secondary') return { ...base, backgroundColor: '#fffef9', border: '1px solid #a9a69d', color: '#171b1e' };
	if (variant === 'danger') return { ...base, backgroundColor: '#b42318', color: '#ffffff' };
	if (variant === 'quiet') return { ...base, backgroundColor: 'transparent', color: '#005bd7' };
	return { ...base, backgroundColor: '#171b1e', color: '#ffffff' };
}

function buttonTextColor(variant: string): string {
	return variant === 'secondary' ? '#171b1e' : variant === 'quiet' ? '#005bd7' : '#ffffff';
}

function textContent(nodes: R4Node[]): R4Value | null {
	const parts: Array<{ kind: 'literal'; value: JsonValue } | R4ExpressionValue> = [];
	for (const node of nodes) {
		if (node.kind === 'text') parts.push(...node.parts);
		if (node.kind === 'element') {
			const nested = textContent(node.children);
			if (nested?.kind === 'literal' || nested?.kind === 'expression') parts.push(nested);
			if (nested?.kind === 'template') parts.push(...nested.parts);
		}
	}
	if (parts.length === 0) return null;
	if (parts.length === 1) return parts[0];
	return {
		kind: 'template',
		parts,
		dependencies: unique(parts.flatMap((part) => (part.kind === 'expression' ? part.dependencies : [])))
	};
}

function collectHandlers(nodes: R4Node[], handlers: Map<string, R4HandlerValue>) {
	for (const node of nodes) {
		if (node.kind === 'element') {
			const activation = node.props.activation;
			if (activation?.kind === 'handler') handlers.set(node.id, activation);
			collectHandlers(node.children, handlers);
		}
		if (node.kind === 'if') {
			collectHandlers(node.consequent, handlers);
			collectHandlers(node.alternate, handlers);
		}
		if (node.kind === 'each') {
			collectHandlers(node.children, handlers);
			collectHandlers(node.fallback, handlers);
		}
	}
}

function emitValue(value: R4Value): string {
	if (value.kind === 'literal') return JSON.stringify(value.value);
	if (value.kind === 'expression') return value.source;
	if (value.kind === 'handler') return value.source;
	return '`' + value.parts.map((part) => (part.kind === 'literal' ? escapeTemplate(String(part.value ?? '')) : `\${${part.source}}`)).join('') + '`';
}

function literal(value: R4Value | undefined): JsonValue | undefined {
	return value?.kind === 'literal' ? value.value : undefined;
}

function spacingValue(value: JsonValue | undefined): string | undefined {
	return typeof value === 'string' ? spacing[value] : undefined;
}

function paddingValue(value: JsonValue | undefined): string | undefined {
	if (typeof value === 'string') return spacing[value];
	if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
	const vertical = typeof value.y === 'string' ? value.y : 'none';
	const horizontal = typeof value.x === 'string' ? value.x : 'none';
	return [value.top ?? vertical, value.right ?? horizontal, value.bottom ?? vertical, value.left ?? horizontal]
		.map((part) => (typeof part === 'string' ? spacing[part] : '0px'))
		.join(' ');
}

function sizeValue(value: JsonValue | undefined): string | undefined {
	if (typeof value === 'number') return `${value}px`;
	if (value === 'fill') return '100%';
	if (value === 'fit') return 'auto';
	return undefined;
}

function radiusValue(value: JsonValue | undefined): string | undefined {
	if (value === true) return radii.md;
	return typeof value === 'string' ? radii[value] : undefined;
}

function backgroundValue(value: JsonValue | undefined): string | undefined {
	if (typeof value === 'string') return value;
	if (!value || Array.isArray(value) || typeof value !== 'object' || value.type !== 'linear' || !Array.isArray(value.colors)) return undefined;
	return `linear-gradient(${typeof value.angle === 'number' ? value.angle : 135}deg, ${value.colors.join(', ')})`;
}

function alignmentValue(value: JsonValue | undefined): string {
	return value === 'start' ? 'flex-start' : value === 'end' ? 'flex-end' : typeof value === 'string' ? value : 'stretch';
}

function distributionValue(value: JsonValue | undefined): string {
	const values: Record<string, string> = {
		start: 'flex-start',
		end: 'flex-end',
		center: 'center',
		between: 'space-between',
		around: 'space-around',
		evenly: 'space-evenly'
	};
	return typeof value === 'string' ? (values[value] ?? 'flex-start') : 'flex-start';
}

function lynxTag(primitive: PrimitiveName): string {
	if (primitive === 'Text' || primitive === 'Icon') return 'text';
	if (primitive === 'Image') return 'image';
	if (primitive === 'Input') return 'input';
	if (primitive === 'Scroll') return 'scroll-view';
	return 'view';
}

function handlerName(id: string): string {
	return `handle_${id.replaceAll('-', '_')}`;
}

function setter(name: string): string {
	return `set${name[0].toUpperCase()}${name.slice(1)}`;
}

function tabs(depth: number): string {
	return '\t'.repeat(depth + 1);
}

function indentBlock(value: string, depth: number): string {
	return value
		.split('\n')
		.map((line) => `${'\t'.repeat(depth)}${line}`)
		.join('\n');
}

function escapeTemplate(value: string): string {
	return value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
}

function unique(values: string[]): string[] {
	return [...new Set(values)].sort();
}

function lynxRequirement(requirement: string): string {
	const requirements: Record<string, string> = {
		'image-loading': 'lynx:image',
		navigation: 'r4-host:navigation',
		'text-input': 'lynx:xelement-input'
	};
	return requirements[requirement] ?? requirement;
}
