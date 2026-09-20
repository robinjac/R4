import { resolve } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import {
	R4_STUDIO_PROJECT_CHANGE_EVENT,
	R4_STUDIO_PROJECT_PROTOCOL_VERSION,
	R4_STUDIO_PROJECT_REQUEST_EVENT,
	R4_STUDIO_PROJECT_RESPONSE_EVENT,
	type R4StudioProjectRequest,
	type R4StudioProjectResponse
} from '../src/studio/project-protocol.js';
import { StudioProjectService, StudioProjectServiceError, toStudioProjectError } from './studio-project-service.js';

export interface R4StudioProjectPluginOptions {
	workspaceRoot?: string;
}

export function r4StudioProjectPlugin(options: R4StudioProjectPluginOptions = {}): Plugin {
	return {
		name: 'r4-studio-project-service',
		apply: 'serve',
		async configureServer(server) {
			if (!isLoopbackHost(server.config.server.host)) {
				server.config.logger.warn('R4 Studio project service disabled because the Vite server is not loopback-only.');
				registerUnavailableHandler(server, 'The local Studio project service requires a loopback-only Vite server.');
				return;
			}

			let service: StudioProjectService;
			try {
				service = await StudioProjectService.create({
					workspaceRoot: resolve(options.workspaceRoot ?? process.env.R4_STUDIO_WORKSPACE_ROOT ?? server.config.root),
					viteRoot: server.config.root
				});
			} catch (error) {
				const message = error instanceof StudioProjectServiceError ? error.message : 'The local Studio project service could not start.';
				server.config.logger.error(message);
				registerUnavailableHandler(server, message);
				return;
			}

			const unsubscribe = service.subscribe((change) => server.ws.send(R4_STUDIO_PROJECT_CHANGE_EVENT, change));
			const scheduleRescan = createRescanScheduler(service, server);
			server.watcher.add(service.root);
			server.watcher.on('add', scheduleRescan);
			server.watcher.on('change', scheduleRescan);
			server.watcher.on('unlink', scheduleRescan);
			server.watcher.on('addDir', scheduleRescan);
			server.watcher.on('unlinkDir', scheduleRescan);

			server.ws.on(R4_STUDIO_PROJECT_REQUEST_EVENT, async (request: R4StudioProjectRequest, client) => {
				const response = await handleRequest(service, request);
				client.send(R4_STUDIO_PROJECT_RESPONSE_EVENT, response);
			});

			server.httpServer?.once('close', () => {
				unsubscribe();
				server.watcher.off('add', scheduleRescan);
				server.watcher.off('change', scheduleRescan);
				server.watcher.off('unlink', scheduleRescan);
				server.watcher.off('addDir', scheduleRescan);
				server.watcher.off('unlinkDir', scheduleRescan);
			});
		}
	};
}

async function handleRequest(service: StudioProjectService, request: R4StudioProjectRequest): Promise<R4StudioProjectResponse> {
	const requestId = typeof request?.requestId === 'number' ? request.requestId : -1;
	try {
		if (request?.protocolVersion !== R4_STUDIO_PROJECT_PROTOCOL_VERSION) {
			throw new StudioProjectServiceError('protocol-mismatch', 'The Studio project protocol version is not supported.', false);
		}
		if (request.type === 'connect') return service.connect(request.requestId);
		if (request.type === 'read') return service.read(request.requestId, request.sessionId, request.documentId, request.expectedRevision);
		if (request.type === 'rescan') {
			if (request.sessionId !== service.sessionId) throw new StudioProjectServiceError('invalid-session', 'The Studio project session is no longer current.');
			await service.rescan(true);
			return service.connect(request.requestId);
		}
		throw new StudioProjectServiceError('request-failed', 'The Studio project request is invalid.');
	} catch (error) {
		return toStudioProjectError(requestId, error);
	}
}

function registerUnavailableHandler(server: ViteDevServer, message: string) {
	server.ws.on(R4_STUDIO_PROJECT_REQUEST_EVENT, (request: R4StudioProjectRequest, client) => {
		client.send(R4_STUDIO_PROJECT_RESPONSE_EVENT, {
			type: 'error',
			protocolVersion: R4_STUDIO_PROJECT_PROTOCOL_VERSION,
			requestId: typeof request?.requestId === 'number' ? request.requestId : -1,
			code: 'service-unavailable',
			message,
			recoverable: false
		} satisfies R4StudioProjectResponse);
	});
}

function createRescanScheduler(service: StudioProjectService, server: ViteDevServer) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return (path: string) => {
		if (!path.startsWith(service.root) || (!path.endsWith('.r4.svelte') && !path.endsWith('/'))) return;
		clearTimeout(timer);
		timer = setTimeout(() => {
			void service.rescan(true).catch(() => server.config.logger.warn('R4 Studio could not refresh the project manifest.'));
		}, 75);
	};
}

function isLoopbackHost(host: string | boolean | undefined): boolean {
	return host === undefined || host === false || host === 'localhost' || host === '127.0.0.1' || host === '::1';
}
