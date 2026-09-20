import type { R4Node } from '../lib/compiler/index.js';
import type { R4StudioNodeRef, R4StudioSnapshot } from './types.js';

export function createStudioNodeRef(snapshot: R4StudioSnapshot, nodeId: string): R4StudioNodeRef {
	if (!resolveNode(snapshot.compilation.ir?.root ?? [], nodeId)) throw new Error(`Semantic node ${nodeId} does not exist in this snapshot.`);
	return { document: snapshot.document, target: { kind: 'node', id: nodeId } };
}

export function resolveStudioNode(snapshot: R4StudioSnapshot, ref: R4StudioNodeRef): R4Node | null {
	if (ref.document.id !== snapshot.document.id || ref.document.revision !== snapshot.document.revision) return null;
	return resolveNode(snapshot.compilation.ir?.root ?? [], ref.target.id);
}

export function findStudioNodeAtOffset(snapshot: R4StudioSnapshot, offset: number): R4Node | null {
	if (!Number.isInteger(offset) || offset < 0 || offset > snapshot.source.length) return null;
	return flattenNodes(snapshot.compilation.ir?.root ?? [])
		.filter((node) => node.range.start.offset <= offset && offset < node.range.end.offset)
		.sort((left, right) => rangeLength(left) - rangeLength(right))[0] ?? null;
}

export function sourceForStudioNode(snapshot: R4StudioSnapshot, ref: R4StudioNodeRef): string | null {
	const node = resolveStudioNode(snapshot, ref);
	return node ? snapshot.source.slice(node.range.start.offset, node.range.end.offset) : null;
}

function resolveNode(nodes: R4Node[], id: string): R4Node | null {
	return flattenNodes(nodes).find((node) => node.id === id) ?? null;
}

function flattenNodes(nodes: R4Node[]): R4Node[] {
	return nodes.flatMap((node) => {
		if (node.kind === 'element' || node.kind === 'component') return [node, ...flattenNodes(node.children)];
		if (node.kind === 'if') return [node, ...flattenNodes(node.consequent), ...flattenNodes(node.alternate)];
		if (node.kind === 'each') return [node, ...flattenNodes(node.children), ...flattenNodes(node.fallback)];
		return [node];
	});
}

function rangeLength(node: R4Node) {
	return node.range.end.offset - node.range.start.offset;
}
