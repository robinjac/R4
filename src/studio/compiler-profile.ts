import { VERSION as SVELTE_VERSION } from 'svelte/compiler';
import { R4_IR_VERSION } from '../lib/compiler/index.js';

export const R4_STUDIO_COMPILER_PROFILE_VERSION = 1 as const;

export interface R4StudioCompilerProfile {
	schema: 'r4.studio.compiler-profile';
	version: typeof R4_STUDIO_COMPILER_PROFILE_VERSION;
	analyzerVersion: 1;
	irVersion: typeof R4_IR_VERSION;
	svelteVersion: string;
	primitiveModules: string[];
}

export function createStudioCompilerProfile(primitiveModules: string[]): R4StudioCompilerProfile {
	return {
		schema: 'r4.studio.compiler-profile',
		version: R4_STUDIO_COMPILER_PROFILE_VERSION,
		analyzerVersion: 1,
		irVersion: R4_IR_VERSION,
		svelteVersion: SVELTE_VERSION,
		primitiveModules: [...primitiveModules]
	};
}

export const R4_STUDIO_SCRATCH_COMPILER_PROFILE = createStudioCompilerProfile(['r4']);
export const R4_STUDIO_PROJECT_COMPILER_PROFILE = createStudioCompilerProfile(['r4', '$lib', '$lib/index.js']);

export function serializeStudioCompilerProfile(profile: R4StudioCompilerProfile): string {
	assertSupportedStudioCompilerProfile(profile);
	return JSON.stringify({
		schema: profile.schema,
		version: profile.version,
		analyzerVersion: profile.analyzerVersion,
		irVersion: profile.irVersion,
		svelteVersion: profile.svelteVersion,
		primitiveModules: profile.primitiveModules
	});
}

export function assertSupportedStudioCompilerProfile(profile: R4StudioCompilerProfile): void {
	if (
		profile.schema !== 'r4.studio.compiler-profile' ||
		profile.version !== R4_STUDIO_COMPILER_PROFILE_VERSION ||
		profile.analyzerVersion !== 1 ||
		profile.irVersion !== R4_IR_VERSION ||
		profile.svelteVersion !== SVELTE_VERSION ||
		!Array.isArray(profile.primitiveModules) ||
		profile.primitiveModules.some((module) => typeof module !== 'string' || module.length === 0)
	) {
		throw new Error('Unsupported R4 Studio compiler profile.');
	}
}
