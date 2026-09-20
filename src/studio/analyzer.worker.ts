import { analyzeStudioSource } from './analyze.js';
import type { R4StudioAnalyzeRequest, R4StudioAnalyzeResponse } from './types.js';

const scope = self as unknown as {
	onmessage: ((event: MessageEvent<R4StudioAnalyzeRequest>) => void) | null;
	postMessage(message: R4StudioAnalyzeResponse): void;
};

scope.onmessage = (event) => {
	const request = event.data;
	if (request.type !== 'analyze') return;

	void analyzeStudioSource(request.source, request.documentId)
		.then((snapshot) => {
			scope.postMessage({ type: 'result', requestId: request.requestId, snapshot });
		})
		.catch((error: unknown) => {
			scope.postMessage({
				type: 'failure',
				requestId: request.requestId,
				message: error instanceof Error ? error.message : String(error)
			});
		});
};

export {};
