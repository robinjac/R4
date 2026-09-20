import { compileR4 } from '../lib/compiler/index.js';
import { createStudioSnapshot } from './snapshot.js';
import type { R4StudioSnapshot } from './types.js';

export const MAX_STUDIO_SOURCE_LENGTH = 200_000;
const COMPILER_PROFILE = 'r4-studio:1;primitive-modules:r4';

export async function analyzeStudioSource(source: string, documentId = 'studio/Untitled.r4.svelte'): Promise<R4StudioSnapshot> {
	if (source.length > MAX_STUDIO_SOURCE_LENGTH) {
		throw new RangeError(`Studio source exceeds the ${MAX_STUDIO_SOURCE_LENGTH.toLocaleString('en-US')} character limit.`);
	}

	return createStudioSnapshot(
		source,
		documentId,
		compileR4(source, { filename: documentId, primitiveModules: ['r4'] }),
		COMPILER_PROFILE
	);
}
