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
		Switch: 'UISwitch',
		Navigation: 'UINavigationBar / UITabBar policy',
		NavigationItem: 'UITabBarItem / navigation action',
		List: 'UICollectionView',
		ListItem: 'UICollectionViewCell',
		Feed: 'UICollectionView live-feed policy',
		FeedItem: 'UICollectionViewCell feed entry',
		Badge: 'UILabel status capsule',
		Tabs: 'UISegmentedControl / tab policy',
		Tab: 'tab selection action',
		Form: 'form coordination policy',
		Textarea: 'UITextView',
		NumberInput: 'UITextField numeric keyboard',
		Select: 'UIPickerView policy',
		Checkbox: 'UIButton checkbox semantics',
		DateInput: 'UIDatePicker date mode',
		TimeInput: 'UIDatePicker time mode',
		Alert: 'accessible announcement view',
		Progress: 'UIProgressView',
		Sheet: 'UISheetPresentationController',
		RichText: 'native attributed text policy',
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
		Switch: 'Switch',
		Navigation: 'NavigationBar / NavigationRail policy',
		NavigationItem: 'navigation destination action',
		List: 'RecyclerView',
		ListItem: 'RecyclerView item',
		Feed: 'RecyclerView live-feed policy',
		FeedItem: 'RecyclerView feed entry',
		Badge: 'TextView status capsule',
		Tabs: 'TabLayout',
		Tab: 'tab selection action',
		Form: 'form coordination policy',
		Textarea: 'multiline EditText',
		NumberInput: 'numeric EditText',
		Select: 'Spinner / picker policy',
		Checkbox: 'CheckBox',
		DateInput: 'DatePicker',
		TimeInput: 'TimePicker',
		Alert: 'accessible announcement view',
		Progress: 'ProgressIndicator',
		Sheet: 'ModalBottomSheet',
		RichText: 'Spannable text policy',
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
		Switch: 'NSSwitch',
		Navigation: 'NSToolbar / sidebar policy',
		NavigationItem: 'navigation destination action',
		List: 'NSCollectionView',
		ListItem: 'NSCollectionViewItem',
		Feed: 'NSCollectionView live-feed policy',
		FeedItem: 'NSCollectionViewItem feed entry',
		Badge: 'NSTextField status capsule',
		Tabs: 'NSSegmentedControl',
		Tab: 'tab selection action',
		Form: 'form coordination policy',
		Textarea: 'NSTextView',
		NumberInput: 'numeric NSTextField',
		Select: 'NSPopUpButton policy',
		Checkbox: 'NSButton checkbox',
		DateInput: 'NSDatePicker date mode',
		TimeInput: 'NSDatePicker time mode',
		Alert: 'accessible announcement view',
		Progress: 'NSProgressIndicator',
		Sheet: 'sheet presentation',
		RichText: 'NSAttributedString policy',
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
		Switch: 'ToggleSwitch',
		Navigation: 'NavigationView policy',
		NavigationItem: 'NavigationViewItem',
		List: 'ListView',
		ListItem: 'ListViewItem',
		Feed: 'ListView live-feed policy',
		FeedItem: 'ListViewItem feed entry',
		Badge: 'InfoBadge / TextBlock policy',
		Tabs: 'TabView',
		Tab: 'TabViewItem selection action',
		Form: 'form coordination policy',
		Textarea: 'multiline TextBox',
		NumberInput: 'NumberBox',
		Select: 'ComboBox policy',
		Checkbox: 'CheckBox',
		DateInput: 'DatePicker',
		TimeInput: 'TimePicker',
		Alert: 'InfoBar policy',
		Progress: 'ProgressBar / ProgressRing',
		Sheet: 'ContentDialog / sheet policy',
		RichText: 'RichTextBlock policy',
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
	if (node.kind === 'component') {
		return [
			{
				id: node.id,
				semantic: `composition:${node.name}`,
				implementation: platform === 'web' ? `Svelte component ${node.source}` : `R4 composition boundary ${node.source}`,
				children: node.children.flatMap((child) => projectNode(child, platform))
			}
		];
	}
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
