import type { R4StudioSourceTransaction } from './contracts.js';

export interface R4StudioHistory {
	undo: R4StudioSourceTransaction[];
	redo: R4StudioSourceTransaction[];
}

export function createStudioHistory(): R4StudioHistory {
	return { undo: [], redo: [] };
}

export function recordStudioEdit(history: R4StudioHistory, undo: R4StudioSourceTransaction): R4StudioHistory {
	return { undo: [...history.undo, undo], redo: [] };
}

export function completeStudioUndo(
	history: R4StudioHistory,
	redo: R4StudioSourceTransaction
): R4StudioHistory {
	return { undo: history.undo.slice(0, -1), redo: [...history.redo, redo] };
}

export function completeStudioRedo(
	history: R4StudioHistory,
	undo: R4StudioSourceTransaction
): R4StudioHistory {
	return { undo: [...history.undo, undo], redo: history.redo.slice(0, -1) };
}

export function invalidateStudioHistory(): R4StudioHistory {
	return createStudioHistory();
}
