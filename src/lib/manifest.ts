export const primitiveManifest = {
	View: {
		domain: 'structure',
		intent: 'generic-container',
		web: 'div',
		lynx: 'view'
	},
	Stack: {
		domain: 'layout',
		intent: 'ordered-linear-layout',
		web: 'div + flex',
		lynx: 'view + flex'
	},
	Grid: {
		domain: 'layout',
		intent: 'two-dimensional-layout',
		web: 'div + grid',
		lynx: 'view + grid'
	},
	Layer: {
		domain: 'layout',
		intent: 'overlapping-layout',
		web: 'div + grid overlap',
		lynx: 'view + absolute policy'
	},
	Text: {
		domain: 'content',
		intent: 'text',
		web: 'p / span / heading',
		lynx: 'text'
	},
	Image: {
		domain: 'content',
		intent: 'image',
		web: 'img',
		lynx: 'image'
	},
	Icon: {
		domain: 'content',
		intent: 'symbol',
		web: 'span + accessible name policy',
		lynx: 'text/image policy'
	},
	Button: {
		domain: 'action',
		intent: 'activate',
		web: 'button',
		lynx: 'accessible view + tap'
	},
	Input: {
		domain: 'input',
		intent: 'text-entry',
		web: 'label + input',
		lynx: 'XElement input'
	},
	Switch: {
		domain: 'input',
		intent: 'boolean-setting',
		web: 'label + checkbox switch',
		lynx: 'accessible switch policy'
	},
	Navigation: {
		domain: 'navigation',
		intent: 'primary-navigation',
		web: 'nav',
		lynx: 'navigation container policy'
	},
	NavigationItem: {
		domain: 'navigation',
		intent: 'select-destination',
		web: 'button + current-page state',
		lynx: 'navigation item policy'
	},
	List: {
		domain: 'collection',
		intent: 'ordered-collection',
		web: 'ul',
		lynx: 'list container policy'
	},
	ListItem: {
		domain: 'collection',
		intent: 'collection-item',
		web: 'li + optional button',
		lynx: 'list item policy'
	},
	Feed: {
		domain: 'collection',
		intent: 'chronological-feed',
		web: 'ol + accessible log',
		lynx: 'live feed policy'
	},
	FeedItem: {
		domain: 'collection',
		intent: 'feed-entry',
		web: 'li',
		lynx: 'feed item policy'
	},
	Badge: {
		domain: 'content',
		intent: 'status-label',
		web: 'span',
		lynx: 'text status policy'
	},
	Tabs: {
		domain: 'navigation',
		intent: 'tab-set',
		web: 'tablist',
		lynx: 'tab container policy'
	},
	Tab: {
		domain: 'navigation',
		intent: 'select-tab',
		web: 'tab button',
		lynx: 'tab item policy'
	},
	Form: {
		domain: 'input',
		intent: 'submit-values',
		web: 'form',
		lynx: 'form coordination policy'
	},
	Textarea: {
		domain: 'input',
		intent: 'multiline-text-entry',
		web: 'label + textarea',
		lynx: 'multiline input policy'
	},
	NumberInput: {
		domain: 'input',
		intent: 'numeric-entry',
		web: 'label + numeric input',
		lynx: 'numeric input policy'
	},
	Select: {
		domain: 'input',
		intent: 'select-value',
		web: 'label + select',
		lynx: 'picker policy'
	},
	Checkbox: {
		domain: 'input',
		intent: 'boolean-choice',
		web: 'label + checkbox',
		lynx: 'checkbox policy'
	},
	DateInput: {
		domain: 'input',
		intent: 'date-entry',
		web: 'label + date input',
		lynx: 'date picker policy'
	},
	TimeInput: {
		domain: 'input',
		intent: 'time-entry',
		web: 'label + time input',
		lynx: 'time picker policy'
	},
	Alert: {
		domain: 'feedback',
		intent: 'notice',
		web: 'status / alert',
		lynx: 'accessible announcement policy'
	},
	Progress: {
		domain: 'feedback',
		intent: 'progress',
		web: 'progress',
		lynx: 'progress indicator policy'
	},
	Sheet: {
		domain: 'overlay',
		intent: 'modal-sheet',
		web: 'dialog',
		lynx: 'modal sheet policy'
	},
	RichText: {
		domain: 'content',
		intent: 'structured-text',
		web: 'article',
		lynx: 'structured text policy'
	},
	Page: {
		domain: 'application',
		intent: 'page',
		web: 'main + document metadata',
		lynx: 'page'
	},
	Scroll: {
		domain: 'application',
		intent: 'scroll-region',
		web: 'div + overflow',
		lynx: 'scroll-view'
	},
	Link: {
		domain: 'navigation',
		intent: 'navigate',
		web: 'a + URL/history',
		lynx: 'accessible view + host navigation'
	}
} as const;

export type PrimitiveName = keyof typeof primitiveManifest;
export type PrimitiveDomain = (typeof primitiveManifest)[PrimitiveName]['domain'];

export function isPrimitiveName(value: string): value is PrimitiveName {
	return value in primitiveManifest;
}
