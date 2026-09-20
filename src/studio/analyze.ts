import { compileR4, R4_IR_VERSION } from '../lib/compiler/index.js';
import { R4_STUDIO_SNAPSHOT_VERSION, type R4StudioSnapshot } from './types.js';

export const MAX_STUDIO_SOURCE_LENGTH = 200_000;
const COMPILER_PROFILE = 'r4-studio:1;primitive-modules:r4';

export async function analyzeStudioSource(source: string, documentId = 'studio/Untitled.r4.svelte'): Promise<R4StudioSnapshot> {
	if (source.length > MAX_STUDIO_SOURCE_LENGTH) {
		throw new RangeError(`Studio source exceeds the ${MAX_STUDIO_SOURCE_LENGTH.toLocaleString('en-US')} character limit.`);
	}

	const revision = await createRevision(documentId, source);
	return {
		schema: 'r4.studio.snapshot',
		version: R4_STUDIO_SNAPSHOT_VERSION,
		document: { id: documentId, revision },
		source,
		compilation: compileR4(source, { filename: documentId, primitiveModules: ['r4'] })
	};
}

async function createRevision(documentId: string, source: string): Promise<string> {
	const input = new TextEncoder().encode(`${R4_IR_VERSION}\0${COMPILER_PROFILE}\0${documentId}\0${source}`);
	const digest = await crypto.subtle.digest('SHA-256', input);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
