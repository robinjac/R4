import type { R4CompileResult } from '../lib/compiler/index.js';
import type { R4StudioCompilerProfile } from './compiler-profile.js';

export const R4_STUDIO_SNAPSHOT_VERSION = 2 as const;

export interface R4StudioDocumentRef {
	id: string;
	revision: string;
}

export interface R4StudioSnapshot {
	schema: 'r4.studio.snapshot';
	version: typeof R4_STUDIO_SNAPSHOT_VERSION;
	document: R4StudioDocumentRef;
	source: string;
	compilerProfile: R4StudioCompilerProfile;
	compilation: R4CompileResult;
}

export interface R4StudioNodeRef {
	document: R4StudioDocumentRef;
	target: {
		kind: 'node';
		id: string;
	};
}

export type R4StudioSelectionOrigin = 'source' | 'canvas' | 'composition' | 'semantic';

export interface R4StudioSelection {
	ref: R4StudioNodeRef;
	origin: R4StudioSelectionOrigin;
}

export interface R4StudioAnalyzeRequest {
	type: 'analyze';
	requestId: number;
	documentId: string;
	source: string;
}

export type R4StudioAnalyzeResponse =
	| {
			type: 'result';
			requestId: number;
			snapshot: R4StudioSnapshot;
	  }
	| {
			type: 'failure';
			requestId: number;
			message: string;
	  };
