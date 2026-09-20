import type { Component } from 'svelte';
import type { R4BackendArtifact } from '../lib/backends/index.js';
import type { R4CompileResult, R4Platform } from '../lib/compiler/index.js';

export type WorkbenchEntryKind = 'experiment' | 'primitive' | 'composition' | 'application';

export interface ExperimentMeta {
	id: string;
	title: string;
	group: string;
	description: string;
	status?: 'keep' | 'modify' | 'reject' | 'explore';
	kind?: WorkbenchEntryKind;
}

export interface WorkbenchHighlightedCode {
	colors: string[];
	lines: Array<Array<[content: string, color: number]>>;
}

export interface WorkbenchHighlighting {
	source: WorkbenchHighlightedCode;
	ast: WorkbenchHighlightedCode;
	semantic: WorkbenchHighlightedCode;
	platforms: Record<R4Platform, WorkbenchHighlightedCode>;
	lynx: WorkbenchHighlightedCode;
}

export interface WorkbenchCompilation {
	compiler: R4CompileResult;
	backends: {
		lynx: R4BackendArtifact | null;
	};
}

export interface WorkbenchExperiment extends ExperimentMeta {
	kind: WorkbenchEntryKind;
	path: string;
	component: Component;
	source: string;
	loadHighlighting: () => Promise<WorkbenchHighlighting>;
	compilation: WorkbenchCompilation;
}
