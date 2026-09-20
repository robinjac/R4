import { experiments } from '../workbench/registry.js';
import type { WorkbenchEntryKind, WorkbenchExperiment } from '../workbench/types.js';

export interface R4StudioProjectGroup {
	kind: WorkbenchEntryKind;
	label: string;
	documents: WorkbenchExperiment[];
}

const groupLabels: Array<{ kind: WorkbenchEntryKind; label: string }> = [
	{ kind: 'application', label: 'Applications' },
	{ kind: 'composition', label: 'Compositions' },
	{ kind: 'primitive', label: 'Primitives' },
	{ kind: 'experiment', label: 'Research fixtures' }
];

export const studioProjectDocuments = [...experiments];

export const studioProjectGroups: R4StudioProjectGroup[] = groupLabels
	.map(({ kind, label }) => ({
		kind,
		label,
		documents: studioProjectDocuments.filter((document) => document.kind === kind).sort((left, right) => left.title.localeCompare(right.title))
	}))
	.filter((group) => group.documents.length > 0);

export function studioProjectDocument(id: string): WorkbenchExperiment | undefined {
	return studioProjectDocuments.find((document) => document.id === id);
}
