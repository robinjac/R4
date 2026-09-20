import type { Component } from 'svelte';
import { experiments } from '../workbench/registry.js';
import type { WorkbenchEntryKind, WorkbenchExperiment } from '../workbench/types.js';
import type { R4StudioProjectDocument as R4StudioServiceDocument } from './project-protocol.js';

type StudioExperimentModule = { default: Component };

export interface R4StudioPreview extends WorkbenchExperiment {
	studioComponent: Component;
	studioArtifactId: string;
}

export interface R4StudioProjectDocument {
	id: string;
	serviceId: string | null;
	title: string;
	group: string;
	description: string;
	kind: WorkbenchEntryKind;
	path: string;
	revision?: string;
	preview?: R4StudioPreview;
}

export interface R4StudioProjectGroup {
	kind: WorkbenchEntryKind;
	label: string;
	documents: R4StudioProjectDocument[];
}

const groupLabels: Array<{ kind: WorkbenchEntryKind; label: string }> = [
	{ kind: 'application', label: 'Applications' },
	{ kind: 'composition', label: 'Compositions' },
	{ kind: 'primitive', label: 'Primitives' },
	{ kind: 'experiment', label: 'Research fixtures' }
];

const studioComponentModules = import.meta.glob<StudioExperimentModule>('../research/**/*.r4.svelte', {
	eager: true,
	query: '?r4-studio-entry'
});
const studioArtifactModules = import.meta.glob<string>('../research/**/*.r4.svelte', {
	eager: true,
	query: '?r4-studio-artifact',
	import: 'default'
});
const studioExperiments: R4StudioPreview[] = experiments.map((experiment) => {
	const path = `../${experiment.path}`;
	const studioModule = studioComponentModules[path];
	const studioArtifactId = studioArtifactModules[path];
	if (!studioModule || !studioArtifactId) throw new Error(`Incomplete Studio runtime artifacts for ${path}`);
	return { ...experiment, studioComponent: studioModule.default, studioArtifactId };
});
const repositoryByServiceId = new Map(studioExperiments.map((experiment) => [`src/${experiment.path}`, experiment]));

export const studioProjectDocuments: R4StudioProjectDocument[] = studioExperiments.map((experiment) => ({
	id: experiment.id,
	serviceId: null,
	title: experiment.title,
	group: experiment.group,
	description: experiment.description,
	kind: experiment.kind,
	path: experiment.path,
	preview: experiment
}));

export const studioProjectGroups = groupStudioProjectDocuments(studioProjectDocuments);

export function studioProjectDocumentsFromService(
	documents: R4StudioServiceDocument[],
	allowRepositoryPreview: boolean
): R4StudioProjectDocument[] {
	return documents.map((document) => {
		const repository = allowRepositoryPreview ? repositoryByServiceId.get(document.id) : undefined;
		if (repository) {
			return {
				id: repository.id,
				serviceId: document.id,
				title: repository.title,
				group: repository.group,
				description: repository.description,
				kind: repository.kind,
				path: repository.path,
				revision: document.revision,
				preview: repository
			};
		}

		return {
			id: document.id,
			serviceId: document.id,
			title: document.title,
			group: document.parent || 'Workspace',
			description: 'Discovered project source. Preview execution is unavailable until this workspace has an isolated runtime.',
			kind: kindFromPath(document.id),
			path: document.id,
			revision: document.revision
		};
	});
}

export function groupStudioProjectDocuments(documents: R4StudioProjectDocument[]): R4StudioProjectGroup[] {
	return groupLabels
		.map(({ kind, label }) => ({
			kind,
			label,
			documents: documents.filter((document) => document.kind === kind).sort((left, right) => left.title.localeCompare(right.title))
		}))
		.filter((group) => group.documents.length > 0);
}

export function studioProjectDocument(
	id: string,
	documents: R4StudioProjectDocument[] = studioProjectDocuments
): R4StudioProjectDocument | undefined {
	return documents.find((document) => document.id === id || document.serviceId === id || document.preview?.id === id);
}

function kindFromPath(path: string): WorkbenchEntryKind {
	if (path.includes('/primitives/')) return 'primitive';
	if (path.includes('/compositions/')) return 'composition';
	if (path.includes('/applications/')) return 'application';
	return 'experiment';
}
