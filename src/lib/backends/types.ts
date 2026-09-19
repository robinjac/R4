import type { R4Diagnostic, R4SemanticDocument } from '../compiler/index.js';

export interface R4BackendArtifact {
	backend: string;
	target: string;
	status: 'experimental' | 'ready';
	entry: string;
	files: Record<string, string>;
	requirements: string[];
	diagnostics: R4Diagnostic[];
}

export interface R4Backend {
	id: string;
	lower(document: R4SemanticDocument): R4BackendArtifact;
}
