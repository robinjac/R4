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
