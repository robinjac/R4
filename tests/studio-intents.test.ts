import { describe, expect, test } from 'bun:test';
import { createStudioAutomation } from '../src/studio/automation.js';
import {
	createStudioSetPropertyIntent,
	serializeStudioEditIntent,
	validateStudioEditIntent,
	type R4StudioEditIntent
} from '../src/studio/intents.js';
import type { R4StudioNodeRef } from '../src/studio/types.js';

const target: R4StudioNodeRef = {
	document: { id: 'src/App.r4.svelte', revision: 'revision-1' },
	target: { kind: 'node', id: 'node-1' }
};

describe('R4 Studio edit intents', () => {
	test('creates one versioned set-property shape for Inspector, Canvas, and automation', async () => {
		const inspector = createStudioSetPropertyIntent(target, 'title', 'Inspector', { type: 'inspector' }, 'inspector-1');
		const canvas = createStudioSetPropertyIntent(
			target,
			'count',
			2,
			{ type: 'canvas', runtimeInstance: { artifactId: 'artifact-1', instanceId: 'instance-2' } },
			'canvas-1'
		);
		let dispatched: R4StudioEditIntent | null = null;
		const automation = createStudioAutomation(async (intent) => {
			dispatched = intent;
			return 'applied';
		});

		expect(inspector).toMatchObject({ schema: 'r4.studio.edit-intent', version: 1, origin: { type: 'inspector' } });
		expect(canvas).toMatchObject({
			operation: { type: 'set-property', property: 'count', value: 2 },
			origin: { type: 'canvas', runtimeInstance: { artifactId: 'artifact-1', instanceId: 'instance-2' } }
		});
		expect(await automation.setProperty({ id: 'automation-1', runId: 'run-7', target, property: 'disabled', value: false })).toBe('applied');
		expect(dispatched).toMatchObject({
			id: 'automation-1',
			origin: { type: 'automation', runId: 'run-7' },
			operation: { type: 'set-property', property: 'disabled', value: false }
		});
	});

	test('canonicalizes validated data before fingerprinting or audit use', () => {
		const validation = validateStudioEditIntent({
			schema: 'r4.studio.edit-intent',
			version: 1,
			id: 'canonical-1',
			target: {
				...target,
				secret: 'discard me',
				document: { ...target.document, extra: 'discard me' }
			},
			origin: { type: 'automation', runId: 'run-1', value: 'discard me' },
			operation: { type: 'set-property', property: 'title', value: 'Safe', offsets: [1, 2] },
			extra: 'discard me'
		});

		expect(validation.valid).toBe(true);
		if (!validation.valid) throw new Error('Expected a valid intent');
		expect(validation.intent).toEqual({
			schema: 'r4.studio.edit-intent',
			version: 1,
			id: 'canonical-1',
			target,
			origin: { type: 'automation', runId: 'run-1' },
			operation: { type: 'set-property', property: 'title', value: 'Safe' }
		});
		expect(serializeStudioEditIntent(validation.intent)).not.toContain('discard me');
	});

	test('fails closed for unsupported versions, origins, targets, operations, and values', () => {
		const valid = createStudioSetPropertyIntent(target, 'count', 1, { type: 'inspector' }, 'valid-1');
		expect(validateStudioEditIntent({ ...valid, version: 2 })).toMatchObject({ valid: false, code: 'invalid-schema' });
		expect(validateStudioEditIntent({ ...valid, target: { ...target, target: { kind: 'offset', id: '1' } } })).toMatchObject({ valid: false, code: 'invalid-target' });
		expect(validateStudioEditIntent({ ...valid, origin: { type: 'remote' } })).toMatchObject({ valid: false, code: 'invalid-origin' });
		expect(validateStudioEditIntent({ ...valid, operation: { type: 'replace-source', property: 'count', value: 2 } })).toMatchObject({ valid: false, code: 'invalid-operation' });
		expect(validateStudioEditIntent({ ...valid, operation: { ...valid.operation, value: Number.POSITIVE_INFINITY } })).toMatchObject({ valid: false, code: 'invalid-value' });
		expect(validateStudioEditIntent({ ...valid, operation: { ...valid.operation, value: 'x'.repeat(100_001) } })).toMatchObject({ valid: false, code: 'invalid-value' });
	});
});
