import type { R4CompileResult } from '../lib/compiler/index.js';
import { serializeStudioCompilerProfile, type R4StudioCompilerProfile } from './compiler-profile.js';
import { R4_STUDIO_SNAPSHOT_VERSION, type R4StudioSnapshot } from './types.js';

export async function createStudioSnapshot(
	source: string,
	documentId: string,
	compilation: R4CompileResult,
	compilerProfile: R4StudioCompilerProfile
): Promise<R4StudioSnapshot> {
	const revision = await createStudioRevision(documentId, source, compilerProfile);
	return {
		schema: 'r4.studio.snapshot',
		version: R4_STUDIO_SNAPSHOT_VERSION,
		document: { id: documentId, revision },
		source,
		compilerProfile,
		compilation
	};
}

export async function createStudioRevision(
	documentId: string,
	source: string,
	compilerProfile: R4StudioCompilerProfile
): Promise<string> {
	const input = new TextEncoder().encode(`${serializeStudioCompilerProfile(compilerProfile)}\0${documentId}\0${source}`);
	const digest = await crypto.subtle.digest('SHA-256', input);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
