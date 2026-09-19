import type { Insets, Radius, Size, Space, Surface } from '../types.js';

export function space(value: Space | undefined): string | undefined {
	return value ? `var(--r4-space-${value})` : undefined;
}

export function size(value: Size | undefined): string | undefined {
	if (typeof value === 'number') return `${value}px`;
	if (value === 'fill') return '100%';
	if (value === 'fit') return 'fit-content';
	return undefined;
}

export function insets(value: Insets | undefined): string | undefined {
	if (!value) return undefined;
	if (typeof value === 'string') return space(value);

	const vertical = value.y ?? 'none';
	const horizontal = value.x ?? 'none';
	return [
		space(value.top ?? vertical),
		space(value.right ?? horizontal),
		space(value.bottom ?? vertical),
		space(value.left ?? horizontal)
	].join(' ');
}

export function radius(value: Radius | boolean | undefined): string | undefined {
	if (value === true) return 'var(--r4-radius-md)';
	return value ? `var(--r4-radius-${value})` : undefined;
}

export function surface(value: Surface | undefined): string | undefined {
	if (typeof value === 'string') return value;
	if (value?.type === 'linear') {
		return `linear-gradient(${value.angle ?? 135}deg, ${value.colors.join(', ')})`;
	}
	return undefined;
}

export function styleString(values: Record<string, string | number | undefined>): string {
	return Object.entries(values)
		.filter((entry): entry is [string, string | number] => entry[1] !== undefined)
		.map(([property, value]) => `${property}: ${value}`)
		.join('; ');
}
