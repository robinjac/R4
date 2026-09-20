import { getContext, setContext } from 'svelte';

export const R4_STUDIO_RUNTIME_CONTEXT = 'r4:studio-runtime-node';

export interface R4StudioRuntimeIdentity {
	artifactId: string;
	nodeId: string;
	instanceId: string;
}

export function getStudioRuntimeAttributes() {
	const identity = getContext<R4StudioRuntimeIdentity | undefined>(R4_STUDIO_RUNTIME_CONTEXT);
	if (identity) setContext<R4StudioRuntimeIdentity | undefined>(R4_STUDIO_RUNTIME_CONTEXT, undefined);
	return identity
		? {
				'data-r4-studio-artifact': identity.artifactId,
				'data-r4-studio-node': identity.nodeId,
				'data-r4-studio-instance': identity.instanceId
			}
		: {};
}
