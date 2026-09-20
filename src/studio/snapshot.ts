import { R4_IR_VERSION, type R4CompileResult } from '../lib/compiler/index.js';
import { R4_STUDIO_SNAPSHOT_VERSION, type R4StudioSnapshot } from './types.js';

export async function createStudioSnapshot(
	source: string,
	documentId: string,
	compilation: R4CompileResult,
	compilerProfile: string
): Promise<R4StudioSnapshot> {
	const revision = await createRevision(documentId, source, compilerProfile);
	return {
		schema: 'r4.studio.snapshot',
		version: R4_STUDIO_SNAPSHOT_VERSION,
		document: { id: documentId, revision },
		source,
		compilation
	};
}

async function createRevision(documentId: string, source: string, compilerProfile: string): Promise<string> {
	const input = new TextEncoder().encode(`${R4_IR_VERSION}\0${compilerProfile}\0${documentId}\0${source}`);
	const digest = await crypto.subtle.digest('SHA-256', input);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
