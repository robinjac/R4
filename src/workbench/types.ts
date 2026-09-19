import type { Component } from 'svelte';
import type { R4BackendArtifact } from '../lib/backends/index.js';
import type { R4CompileResult } from '../lib/compiler/index.js';

export interface ExperimentMeta {
	id: string;
	title: string;
	group: string;
	description: string;
	status?: 'keep' | 'modify' | 'reject' | 'explore';
}

export interface WorkbenchCompilation {
	compiler: R4CompileResult;
	backends: {
		lynx: R4BackendArtifact | null;
	};
}

export interface WorkbenchExperiment extends ExperimentMeta {
	path: string;
	component: Component;
	source: string;
	compilation: WorkbenchCompilation;
}
