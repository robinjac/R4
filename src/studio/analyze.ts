import { compileR4 } from '../lib/compiler/index.js';
import {
	R4_STUDIO_PROJECT_COMPILER_PROFILE,
	R4_STUDIO_SCRATCH_COMPILER_PROFILE,
	assertSupportedStudioCompilerProfile,
	type R4StudioCompilerProfile
} from './compiler-profile.js';
import { createStudioSnapshot } from './snapshot.js';
import type { R4StudioSnapshot } from './types.js';

export const MAX_STUDIO_SOURCE_LENGTH = 200_000;

export async function analyzeStudioSource(source: string, documentId = 'studio/Untitled.r4.svelte'): Promise<R4StudioSnapshot> {
	return analyzeStudioSourceWithProfile(source, documentId, R4_STUDIO_SCRATCH_COMPILER_PROFILE);
}

export async function analyzeStudioProjectSource(source: string, documentId: string): Promise<R4StudioSnapshot> {
	return analyzeStudioSourceWithProfile(source, documentId, R4_STUDIO_PROJECT_COMPILER_PROFILE);
}

export async function analyzeStudioSourceWithProfile(
	source: string,
	documentId: string,
	compilerProfile: R4StudioCompilerProfile
): Promise<R4StudioSnapshot> {
	if (source.length > MAX_STUDIO_SOURCE_LENGTH) {
		throw new RangeError(`Studio source exceeds the ${MAX_STUDIO_SOURCE_LENGTH.toLocaleString('en-US')} character limit.`);
	}
	assertSupportedStudioCompilerProfile(compilerProfile);

	return createStudioSnapshot(
		source,
		documentId,
		compileR4(source, { filename: documentId, primitiveModules: compilerProfile.primitiveModules }),
		compilerProfile
	);
}
