import type { Component } from 'svelte';
import type { ExperimentMeta, WorkbenchCompilation, WorkbenchExperiment } from './types.js';

type ExperimentModule = {
	default: Component;
	experiment?: ExperimentMeta;
};

const groupOrder = ['Compiler', 'Layout', 'Accessibility'];

const componentModules = import.meta.glob<ExperimentModule>('../research/**/*.r4.svelte', { eager: true });
const sourceModules = import.meta.glob<string>('../research/**/*.r4.svelte', {
	eager: true,
	query: '?raw',
	import: 'default'
});
const compilationModules = import.meta.glob<WorkbenchCompilation>('../research/**/*.r4.svelte', {
	eager: true,
	query: '?r4-ir',
	import: 'default'
});

export const experiments: WorkbenchExperiment[] = Object.entries(componentModules)
	.map(([path, module]) => {
		const fallbackId = path
			.replace('../research/', '')
			.replace('.r4.svelte', '')
			.replaceAll('/', '-');
		const meta = module.experiment ?? {
			id: fallbackId,
			title: fallbackId,
			group: 'Ungrouped',
			description: 'No experiment metadata supplied.',
			status: 'explore' as const
		};

		return {
			...meta,
			path: path.replace('../research/', 'research/'),
			component: module.default,
			source: sourceModules[path],
			compilation: compilationModules[path]
		};
	})
	.sort((left, right) => {
		const leftGroup = groupOrder.indexOf(left.group);
		const rightGroup = groupOrder.indexOf(right.group);
		const groupDifference = (leftGroup === -1 ? groupOrder.length : leftGroup) - (rightGroup === -1 ? groupOrder.length : rightGroup);
		return groupDifference || left.title.localeCompare(right.title);
	});
