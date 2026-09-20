import type { Component } from 'svelte';
import type { ExperimentMeta, WorkbenchCompilation, WorkbenchEntryKind, WorkbenchExperiment, WorkbenchHighlighting } from './types.js';

type ExperimentModule = {
	default: Component;
	experiment?: ExperimentMeta;
};

const groupOrder = ['Compiler', 'Primitives', 'Compositions', 'Applications', 'Layout', 'Accessibility'];

const componentModules = import.meta.glob<ExperimentModule>('../research/**/*.r4.svelte', { eager: true });
const sourceModules = import.meta.glob<string>('../research/**/*.r4.svelte', {
	eager: true,
	query: '?raw',
	import: 'default'
});
const highlightingModules = import.meta.glob<WorkbenchHighlighting>('../research/**/*.r4.svelte', {
	query: '?r4-highlights',
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
			kind: meta.kind ?? kindFromPath(path),
			path: path.replace('../research/', 'research/'),
			component: module.default,
			source: sourceModules[path],
			loadHighlighting: highlightingModules[path],
			compilation: compilationModules[path]
		};
	})
	.sort((left, right) => {
		const leftGroup = groupOrder.indexOf(left.group);
		const rightGroup = groupOrder.indexOf(right.group);
		const groupDifference = (leftGroup === -1 ? groupOrder.length : leftGroup) - (rightGroup === -1 ? groupOrder.length : rightGroup);
		return groupDifference || left.title.localeCompare(right.title);
	});

const experimentIds = new Set<string>();
for (const experiment of experiments) {
	if (experimentIds.has(experiment.id)) throw new Error(`Duplicate Workbench experiment id: ${experiment.id}`);
	experimentIds.add(experiment.id);
}

for (const path of Object.keys(componentModules)) {
	if (!(path in sourceModules) || !(path in compilationModules) || !(path in highlightingModules)) {
		throw new Error(`Incomplete Workbench artifacts for ${path}`);
	}
}

function kindFromPath(path: string): WorkbenchEntryKind {
	if (path.includes('/primitives/')) return 'primitive';
	if (path.includes('/compositions/')) return 'composition';
	if (path.includes('/applications/')) return 'application';
	return 'experiment';
}
