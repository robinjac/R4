import type { Snippet } from 'svelte';

export type Space = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type Radius = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type Size = number | 'fit' | 'fill';
export type Alignment = 'start' | 'center' | 'end' | 'stretch';
export type Distribution = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type Axis = 'horizontal' | 'vertical';

export type Insets =
	| Space
	| {
			x?: Space;
			y?: Space;
			top?: Space;
			right?: Space;
			bottom?: Space;
			left?: Space;
	  };

export type Surface =
	| string
	| {
			type: 'linear';
			colors: string[];
			angle?: number;
	  };

export interface ChildrenProps {
	children?: Snippet;
}

export interface BoxProps {
	width?: Size;
	height?: Size;
	padding?: Insets;
}

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}
