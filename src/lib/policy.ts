import type { R4Node, R4Platform, R4SemanticDocument } from './compiler/index.js';
import { primitiveManifest, type PrimitiveName } from './manifest.js';

export interface PlatformPolicyNode {
	id: string;
	semantic: string;
	implementation: string;
	children: PlatformPolicyNode[];
}

export interface PlatformProjection {
	platform: R4Platform;
	renderer: string;
	mode: 'actual' | 'simulated';
	nodes: PlatformPolicyNode[];
}

const nativeImplementations: Record<Exclude<R4Platform, 'web'>, Record<PrimitiveName, string>> = {
	ios: {
		View: 'UIView',
		Stack: 'R4 linear layout policy',
		Grid: 'R4 grid layout policy',
		Layer: 'overlapping UIView hierarchy',
		Text: 'UILabel / native text policy',
		Image: 'UIImageView',
		Icon: 'symbol/image policy',
		Button: 'UIButton semantics',
		Input: 'UITextField',
		Page: 'UIViewController root',
		Scroll: 'UIScrollView',
		Link: 'host navigation action'
	},
	android: {
		View: 'ViewGroup',
		Stack: 'R4 linear layout policy',
		Grid: 'R4 grid layout policy',
		Layer: 'FrameLayout policy',
		Text: 'TextView',
		Image: 'ImageView',
		Icon: 'symbol/image policy',
		Button: 'Button semantics',
		Input: 'EditText',
		Page: 'Activity/Fragment root',
		Scroll: 'ScrollView',
		Link: 'host navigation action'
	},
	macos: {
		View: 'NSView',
		Stack: 'R4 linear layout policy',
		Grid: 'R4 grid layout policy',
		Layer: 'layered NSView hierarchy',
		Text: 'NSTextField label',
		Image: 'NSImageView',
		Icon: 'SF Symbol/image policy',
		Button: 'NSButton semantics',
		Input: 'NSTextField',
		Page: 'NSViewController root',
		Scroll: 'NSScrollView',
		Link: 'host navigation action'
	},
	windows: {
		View: 'FrameworkElement container',
		Stack: 'StackPanel policy',
		Grid: 'Grid policy',
		Layer: 'Canvas/Grid layering',
		Text: 'TextBlock',
		Image: 'Image',
		Icon: 'FontIcon/Image policy',
		Button: 'Button semantics',
		Input: 'TextBox',
		Page: 'Page root',
		Scroll: 'ScrollViewer',
		Link: 'host navigation action'
	}
};

export function projectPlatform(document: R4SemanticDocument, platform: R4Platform): PlatformProjection {
	return {
		platform,
		renderer: platform === 'web' ? 'Svelte semantic web' : 'Lynx candidate backend',
		mode: platform === 'web' ? 'actual' : 'simulated',
		nodes: document.root.flatMap((node) => projectNode(node, platform))
	};
}

function projectNode(node: R4Node, platform: R4Platform): PlatformPolicyNode[] {
	if (node.kind === 'text') {
		return [{ id: node.id, semantic: 'content:text', implementation: platform === 'web' ? 'text node' : 'text', children: [] }];
	}
	if (node.kind === 'if') return [...node.consequent, ...node.alternate].flatMap((child) => projectNode(child, platform));
	if (node.kind === 'each') return node.children.flatMap((child) => projectNode(child, platform));
	const definition = primitiveManifest[node.primitive];
	return [
		{
			id: node.id,
			semantic: `${definition.domain}:${definition.intent}`,
			implementation: platform === 'web' ? definition.web : nativeImplementations[platform][node.primitive],
			children: node.children.flatMap((child) => projectNode(child, platform))
		}
	];
}
