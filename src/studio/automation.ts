import { createStudioSetPropertyIntent, type R4StudioEditIntent, type R4StudioStaticPropertyValue } from './intents.js';
import type { R4StudioNodeRef } from './types.js';

export interface R4StudioAutomationSetProperty {
	id?: string;
	runId?: string;
	target: R4StudioNodeRef;
	property: string;
	value: R4StudioStaticPropertyValue;
}

export interface R4StudioAutomation<Result> {
	setProperty(input: R4StudioAutomationSetProperty): Promise<Result>;
}

export function createStudioAutomation<Result>(
	dispatch: (intent: R4StudioEditIntent) => Promise<Result>
): R4StudioAutomation<Result> {
	return {
		setProperty(input) {
			return dispatch(
				createStudioSetPropertyIntent(
					input.target,
					input.property,
					input.value,
					{ type: 'automation', runId: input.runId },
					input.id
				)
			);
		}
	};
}
