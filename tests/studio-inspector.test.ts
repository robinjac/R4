import { describe, expect, test } from 'bun:test';
import { analyzeStudioProjectSource } from '../src/studio/analyze.js';
import { applyStudioSourceTransaction } from '../src/studio/contracts.js';
import {
	completeStudioRedo,
	completeStudioUndo,
	createStudioHistory,
	recordStudioEdit
} from '../src/studio/history.js';
import { inspectStudioStaticProperties, planStudioSetProperty, studioNodeCapabilities } from '../src/studio/inspector.js';
import { createStudioNodeRef, findStudioNodeAtOffset } from '../src/studio/selection.js';

const source = `<script lang="ts">
	import { Button as Action, Page } from '$lib/index.js';
	let dynamic = $state('bound');
</script>

<Page title="Inspector">
	<Action label = 'A &amp; B' empty="" disabled count={64} offset={-1.5} dynamic={dynamic}>Run</Action>
</Page>`;

describe('R4 Studio property Inspector', () => {
	test('derives exact edit anchors only for existing static scalar attributes', async () => {
		const { snapshot, ref } = await buttonSelection();
		const properties = inspectStudioStaticProperties(snapshot, ref);

		expect(properties.map(({ name, value }) => ({ name, value }))).toEqual([
			{ name: 'label', value: 'A & B' },
			{ name: 'empty', value: '' },
			{ name: 'disabled', value: true },
			{ name: 'count', value: 64 },
			{ name: 'offset', value: -1.5 }
		]);
		expect(properties.find((property) => property.name === 'label')?.anchor).toMatchObject({
			expected: 'A &amp; B',
			syntax: 'quoted-text',
			quote: "'"
		});
		expect(properties.some((property) => property.name === 'dynamic')).toBe(false);
		expect(studioNodeCapabilities(snapshot, ref).operations).toEqual(['set-property']);
	});

	test('preserves authored syntax and every unrelated byte when changing strings', async () => {
		const { snapshot, ref } = await buttonSelection();
		const plan = planStudioSetProperty(snapshot, {
			id: 'set-label',
			target: ref,
			property: 'label',
			value: `Ready & 'safe' {now}`
		});

		expect(plan.status).toBe('planned');
		if (plan.status !== 'planned') throw new Error('Expected a property transaction');
		const applied = await applyStudioSourceTransaction(snapshot, plan.transaction);
		const expected = source.replace('A &amp; B', 'Ready &amp; &#39;safe&#39; &#123;now&#125;');
		expect(applied.snapshot.source).toBe(expected);
		expect(applied.snapshot.compilerProfile).toEqual(snapshot.compilerProfile);
	});

	test('edits numeric expressions and expands false boolean shorthand without reprinting source', async () => {
		const { snapshot, ref } = await buttonSelection();
		const numberPlan = planStudioSetProperty(snapshot, {
			id: 'set-count',
			target: ref,
			property: 'count',
			value: 72.5
		});
		if (numberPlan.status !== 'planned') throw new Error('Expected a number transaction');
		const numbered = await applyStudioSourceTransaction(snapshot, numberPlan.transaction);
		expect(numbered.snapshot.source).toBe(source.replace('count={64}', 'count={72.5}'));

		const nextNode = findStudioNodeAtOffset(numbered.snapshot, numbered.snapshot.source.indexOf('<Action') + 1);
		if (!nextNode) throw new Error('Expected the edited action node');
		const booleanPlan = planStudioSetProperty(numbered.snapshot, {
			id: 'disable-false',
			target: createStudioNodeRef(numbered.snapshot, nextNode.id),
			property: 'disabled',
			value: false
		});
		if (booleanPlan.status !== 'planned') throw new Error('Expected a boolean transaction');
		const explicit = await applyStudioSourceTransaction(numbered.snapshot, booleanPlan.transaction);
		expect(explicit.snapshot.source).toBe(source.replace('count={64}', 'count={72.5}').replace(' disabled ', ' disabled={false} '));
	});

	test('refuses stale, absent, dynamic, type-changing, and imported-component edits', async () => {
		const { snapshot, ref } = await buttonSelection();
		expect(planStudioSetProperty(snapshot, { id: 'missing', target: ref, property: 'missing', value: 'x' })).toEqual({
			status: 'unavailable',
			reason: 'property-not-found'
		});
		expect(planStudioSetProperty(snapshot, { id: 'dynamic', target: ref, property: 'dynamic', value: 'x' })).toEqual({
			status: 'unavailable',
			reason: 'property-not-found'
		});
		expect(planStudioSetProperty(snapshot, { id: 'type', target: ref, property: 'count', value: '64' })).toEqual({
			status: 'unavailable',
			reason: 'type-mismatch'
		});
		expect(planStudioSetProperty(snapshot, { id: 'stale', target: { ...ref, document: { ...ref.document, revision: 'old' } }, property: 'label', value: 'x' })).toEqual({
			status: 'unavailable',
			reason: 'stale-target'
		});

		const compositionSource = `<script>import Card from './Card.svelte';</script>\n<Card title="Static" />`;
		const composition = await analyzeStudioProjectSource(compositionSource, 'src/Composition.r4.svelte');
		const component = findStudioNodeAtOffset(composition, compositionSource.indexOf('<Card') + 1);
		if (!component) throw new Error('Expected an imported component node');
		const componentRef = createStudioNodeRef(composition, component.id);
		expect(studioNodeCapabilities(composition, componentRef).operations).toEqual([]);
	});

	test('tracks exact inverse transactions through undo and redo history', async () => {
		const { snapshot, ref } = await buttonSelection();
		const plan = planStudioSetProperty(snapshot, { id: 'history-edit', target: ref, property: 'count', value: 65 });
		if (plan.status !== 'planned') throw new Error('Expected a history transaction');
		const forward = await applyStudioSourceTransaction(snapshot, plan.transaction);
		let history = recordStudioEdit(createStudioHistory(), forward.undo);
		expect(history).toMatchObject({ undo: [{ reverses: 'history-edit' }], redo: [] });

		const restored = await applyStudioSourceTransaction(forward.snapshot, history.undo[0]);
		history = completeStudioUndo(history, restored.undo);
		expect(restored.snapshot.source).toBe(source);
		expect(history.undo).toEqual([]);
		expect(history.redo).toHaveLength(1);

		const redone = await applyStudioSourceTransaction(restored.snapshot, history.redo[0]);
		history = completeStudioRedo(history, redone.undo);
		expect(redone.snapshot.source).toBe(forward.snapshot.source);
		expect(history.undo).toHaveLength(1);
		expect(history.redo).toEqual([]);
	});
});

async function buttonSelection() {
	const snapshot = await analyzeStudioProjectSource(source, 'src/Inspector.r4.svelte');
	const node = findStudioNodeAtOffset(snapshot, source.indexOf('<Action') + 1);
	if (!node) throw new Error('Expected an action node');
	return { snapshot, ref: createStudioNodeRef(snapshot, node.id) };
}
