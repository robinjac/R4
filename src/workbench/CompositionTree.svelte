<script lang="ts">
	import type { R4Node, R4SemanticDocument, R4Value } from '$lib/compiler/index.js';

	interface PropSummary {
		name: string;
		value: string;
		kind: 'literal' | 'dynamic' | 'handler';
	}

	interface TreeRow {
		id: string;
		depth: number;
		kind: 'element' | 'component' | 'text' | 'if' | 'each' | 'branch';
		label: string;
		detail: string;
		primitive?: string;
		props: PropSummary[];
		reads: string[];
		writes: string[];
		node?: R4Node;
	}

	interface BindingView {
		name: string;
		kind: string;
		dependencies: string[];
		consumers: string[];
		writers: string[];
	}

	let {
		ir,
		selectedNodeId = null,
		onselect
	}: {
		ir: R4SemanticDocument | null;
		selectedNodeId?: string | null;
		onselect?: (node: R4Node) => void;
	} = $props();
	let rows = $derived(ir ? flattenNodes(ir.root) : []);
	let bindings = $derived(ir ? bindingViews(ir, rows) : []);
	let nodeCount = $derived(rows.filter((row) => row.kind === 'element' || row.kind === 'component').length);
	let structuralCount = $derived(rows.filter((row) => row.kind === 'if' || row.kind === 'each').length);

	function flattenNodes(nodes: R4Node[], depth = 0): TreeRow[] {
		const rows: TreeRow[] = [];
		for (const node of nodes) {
			if (node.kind === 'component') {
				const values = Object.entries(node.props);
				rows.push({
					id: node.id,
					depth,
					kind: 'component',
					label: node.name,
					detail: node.source,
					props: values.map(([name, value]) => summarizeProp(name, value)),
					reads: unique(values.flatMap(([, value]) => readsFrom(value))),
					writes: unique(values.flatMap(([, value]) => (value.kind === 'handler' ? value.writes : []))),
					node
				});
				rows.push(...flattenNodes(node.children, depth + 1));
				continue;
			}

			if (node.kind === 'element') {
				const values = Object.entries(node.props);
				rows.push({
					id: node.id,
					depth,
					kind: 'element',
					label: node.primitive,
					detail: `${node.domain} / ${node.intent}`,
					primitive: node.primitive,
					props: values.map(([name, value]) => summarizeProp(name, value)),
					reads: unique(values.flatMap(([, value]) => readsFrom(value))),
					writes: unique(values.flatMap(([, value]) => (value.kind === 'handler' ? value.writes : []))),
					node
				});
				rows.push(...flattenNodes(node.children, depth + 1));
				continue;
			}

			if (node.kind === 'text') {
				rows.push({
					id: node.id,
					depth,
					kind: 'text',
					label: 'Text content',
					detail: textPreview(node.parts),
					props: [],
					reads: node.dependencies,
					writes: [],
					node
				});
				continue;
			}

			if (node.kind === 'if') {
				rows.push({
					id: node.id,
					depth,
					kind: 'if',
					label: 'Conditional',
					detail: node.test.source,
					props: [],
					reads: node.test.dependencies,
					writes: [],
					node
				});
				rows.push(branchRow(`${node.id}:then`, depth + 1, 'Then'));
				rows.push(...flattenNodes(node.consequent, depth + 2));
				if (node.alternate.length > 0) {
					rows.push(branchRow(`${node.id}:else`, depth + 1, 'Else'));
					rows.push(...flattenNodes(node.alternate, depth + 2));
				}
				continue;
			}

			rows.push({
				id: node.id,
				depth,
				kind: 'each',
				label: 'Collection',
				detail: `${node.item}${node.index ? `, ${node.index}` : ''} in ${node.collection.source}`,
				props: [],
				reads: node.collection.dependencies,
				writes: [],
				node
			});
			rows.push(...flattenNodes(node.children, depth + 1));
			if (node.fallback.length > 0) {
				rows.push(branchRow(`${node.id}:empty`, depth + 1, 'Empty'));
				rows.push(...flattenNodes(node.fallback, depth + 2));
			}
		}
		return rows;
	}

	function branchRow(id: string, depth: number, label: string): TreeRow {
		return { id, depth, kind: 'branch', label, detail: 'branch', props: [], reads: [], writes: [] };
	}

	function summarizeProp(name: string, value: R4Value): PropSummary {
		return {
			name,
			value: valueSource(value),
			kind: value.kind === 'literal' ? 'literal' : value.kind === 'handler' ? 'handler' : 'dynamic'
		};
	}

	function valueSource(value: R4Value): string {
		if (value.kind === 'literal') return JSON.stringify(value.value);
		if (value.kind === 'expression' || value.kind === 'handler') return value.source;
		return value.parts.map((part) => (part.kind === 'literal' ? String(part.value ?? '') : `{${part.source}}`)).join('');
	}

	function readsFrom(value: R4Value): string[] {
		if (value.kind === 'expression' || value.kind === 'template') return value.dependencies;
		if (value.kind === 'handler') return value.reads;
		return [];
	}

	function textPreview(parts: Array<Extract<R4Value, { kind: 'literal' | 'expression' }>>): string {
		const value = parts.map((part) => (part.kind === 'literal' ? String(part.value ?? '') : `{${part.source}}`)).join('').trim();
		if (!value) return 'empty text';
		return value.length > 72 ? `${value.slice(0, 69)}...` : value;
	}

	function bindingViews(document: R4SemanticDocument, treeRows: TreeRow[]): BindingView[] {
		return document.state.map((binding) => ({
			name: binding.name,
			kind: binding.kind,
			dependencies: binding.dependencies,
			consumers: unique(
				document.updates.filter((edge) => edge.from === binding.name).map((edge) => `${edge.kind} ${targetLabel(edge.to, treeRows)}`)
			),
			writers: unique(treeRows.filter((row) => row.writes.includes(binding.name)).map((row) => `${row.label} #${row.id}`))
		}));
	}

	function targetLabel(target: string, treeRows: TreeRow[]): string {
		const row = treeRows.find((item) => target === item.id || target.startsWith(`${item.id}.`));
		if (!row) return target;
		const property = target === row.id ? '' : target.slice(row.id.length);
		return `${row.label}${property} #${row.id}`;
	}

	function unique(values: string[]): string[] {
		return [...new Set(values)];
	}
</script>

{#snippet nodeContent(row: TreeRow)}
	<div class="node-line">
		<span class="node-kind">{row.kind}</span>
		<strong>{row.label}</strong>
		{#if row.kind !== 'branch'}<code class="node-id">#{row.id}</code>{/if}
	</div>
	<div class="node-detail">{row.detail}</div>
	{#if row.props.length > 0}
		<div class="property-list">
			{#each row.props as property (property.name)}
				<span class="property" data-property-kind={property.kind}><code>{property.name}</code><span>{property.kind === 'handler' ? '()' : '='}</span><em>{property.value}</em></span>
			{/each}
		</div>
	{/if}
	{#if row.reads.length > 0 || row.writes.length > 0}
		<div class="dependency-list">
			{#if row.reads.length > 0}<span class="dependency read">reads <code>{row.reads.join(', ')}</code></span>{/if}
			{#if row.writes.length > 0}<span class="dependency write">writes <code>{row.writes.join(', ')}</code></span>{/if}
		</div>
	{/if}
{/snippet}

<section class="composition" aria-label="R4 composition">
	{#if ir}
		<header class="composition-summary">
			<div><span>UI nodes</span><strong>{nodeCount}</strong></div>
			<div><span>Bindings</span><strong>{bindings.length}</strong></div>
			<div><span>Update edges</span><strong>{ir.updates.length}</strong></div>
			<div><span>Branches</span><strong>{structuralCount}</strong></div>
		</header>

		{#if bindings.length > 0}
			<section class="binding-section" aria-labelledby="binding-heading">
				<div class="section-heading">
					<span>Reactive graph</span>
					<strong id="binding-heading">Bindings and consumers</strong>
				</div>
				<div class="binding-list">
					{#each bindings as binding (binding.name)}
						<article class="binding-card" data-binding={binding.name}>
							<div class="binding-name"><span>{binding.kind}</span><code>{binding.name}</code></div>
							{#if binding.dependencies.length > 0}<div class="edge incoming"><span>reads</span><code>{binding.dependencies.join(', ')}</code></div>{/if}
							{#if binding.writers.length > 0}<div class="edge write"><span>written by</span><code>{binding.writers.join(', ')}</code></div>{/if}
							{#if binding.consumers.length > 0}<div class="edge outgoing"><span>updates</span><code>{binding.consumers.join(', ')}</code></div>{/if}
							{#if binding.dependencies.length === 0 && binding.writers.length === 0 && binding.consumers.length === 0}
								<div class="edge idle"><span>static</span><code>No reactive edges</code></div>
							{/if}
						</article>
					{/each}
				</div>
			</section>
		{/if}

		<section class="tree-section" aria-labelledby="tree-heading">
			<div class="section-heading">
				<span>Semantic hierarchy</span>
				<strong id="tree-heading">Composition tree</strong>
			</div>
			<ul class="composition-tree" aria-label="Semantic composition tree">
				{#each rows as row (row.id)}
					<li
						class="composition-node"
						class:has-dependencies={row.reads.length > 0 || row.writes.length > 0}
						style={`--depth: ${row.depth}`}
						data-node-kind={row.kind}
						data-primitive={row.primitive}
						data-node-id={row.node?.id}
						class:selected={selectedNodeId === row.node?.id}
					>
						{#if row.node && onselect}
							<button type="button" class="node-content" aria-pressed={selectedNodeId === row.node.id} onclick={() => onselect?.(row.node!)}>
								{@render nodeContent(row)}
							</button>
						{:else}
							<div class="node-content">{@render nodeContent(row)}</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<div class="composition-empty"><strong>No semantic composition</strong><span>The compiler did not produce Semantic IR for this experiment.</span></div>
	{/if}
</section>

<style>
	.composition {
		min-height: 100%;
		background: #202529;
		color: #e8e9e7;
	}

	.composition-summary {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border-bottom: 1px solid #41474a;
		background: #292f33;
	}

	.composition-summary div {
		display: grid;
		gap: 5px;
		border-right: 1px solid #41474a;
		padding: 12px;
	}

	.composition-summary div:last-child {
		border-right: 0;
	}

	.composition-summary span,
	.section-heading span {
		color: #7f898e;
		font: 0.51rem/1 var(--r4-font-mono);
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.composition-summary strong {
		color: #f2c45e;
		font: 700 0.8rem/1 var(--r4-font-mono);
	}

	.binding-section,
	.tree-section {
		border-bottom: 1px solid #41474a;
	}

	.section-heading {
		display: grid;
		gap: 4px;
		border-bottom: 1px solid #3b4246;
		padding: 12px 14px;
	}

	.section-heading strong {
		font-size: 0.68rem;
	}

	.binding-list {
		display: grid;
		gap: 7px;
		padding: 10px;
	}

	.binding-card {
		display: grid;
		gap: 7px;
		border-left: 2px solid #667176;
		background: #292f33;
		padding: 10px;
	}

	.binding-card:has(.outgoing) {
		border-color: #4f97de;
	}

	.binding-card:has(.write) {
		box-shadow: inset 0 -1px #8b7040;
	}

	.binding-name {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.binding-name span,
	.node-kind {
		border: 1px solid #535d61;
		border-radius: 2px;
		padding: 3px 5px;
		color: #9da6aa;
		font: 0.5rem/1 var(--r4-font-mono);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.binding-name code {
		color: #f0f3f2;
		font: 650 0.67rem/1 var(--r4-font-mono);
	}

	.edge {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr);
		gap: 7px;
		align-items: baseline;
	}

	.edge span {
		color: #818b90;
		font: 0.5rem/1 var(--r4-font-mono);
		text-transform: uppercase;
	}

	.edge code {
		overflow-wrap: anywhere;
		color: #b9c3c7;
		font: 0.56rem/1.45 var(--r4-font-mono);
	}

	.edge.outgoing code {
		color: #82b9ed;
	}

	.edge.write code {
		color: #efc66d;
	}

	.composition-tree {
		display: grid;
		gap: 0;
		margin: 0;
		padding: 8px 0 18px;
		list-style: none;
	}

	.composition-node {
		position: relative;
		margin-left: calc(10px + var(--depth) * 15px);
		border-bottom: 1px solid #333a3e;
		padding: 0;
	}

	.node-content {
		display: block;
		width: 100%;
		border: 0;
		background: transparent;
		padding: 9px 12px 9px 10px;
		color: inherit;
		text-align: left;
	}

	button.node-content {
		cursor: pointer;
	}

	button.node-content:hover {
		background: #30383c;
	}

	button.node-content:focus-visible {
		position: relative;
		z-index: 1;
		outline: 2px solid #70b3f2;
		outline-offset: -2px;
	}

	.composition-node.selected {
		background: #253d4d;
		box-shadow: inset 3px 0 #70b3f2;
	}

	.composition-node::before {
		position: absolute;
		top: 0;
		bottom: 0;
		left: -1px;
		width: 1px;
		background: #465055;
		content: '';
	}

	.composition-node.has-dependencies::before {
		width: 2px;
		background: #4f97de;
	}

	.composition-node[data-node-kind='branch'] {
		border-bottom-style: dashed;
		color: #8f999d;
	}

	.composition-node[data-node-kind='branch'] .node-content {
		padding-top: 7px;
		padding-bottom: 7px;
	}

	.composition-node[data-node-kind='component'] {
		border: 1px solid #4f6670;
		border-left: 3px solid #f2c45e;
		background: #273238;
		margin-top: 5px;
		margin-bottom: 5px;
	}

	.composition-node[data-node-kind='component']::before {
		display: none;
	}

	.node-line {
		display: flex;
		align-items: center;
		gap: 7px;
		min-width: 0;
	}

	.node-line strong {
		font-size: 0.66rem;
	}

	.node-id {
		margin-left: auto;
		color: #667176;
		font: 0.5rem/1 var(--r4-font-mono);
	}

	.node-detail {
		margin-top: 5px;
		overflow: hidden;
		color: #8f999d;
		font: 0.54rem/1.35 var(--r4-font-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.property-list,
	.dependency-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 7px;
	}

	.property,
	.dependency {
		display: inline-flex;
		max-width: 100%;
		align-items: center;
		gap: 3px;
		border: 1px solid #424b4f;
		border-radius: 2px;
		background: #272d31;
		padding: 3px 5px;
		font: 0.5rem/1.25 var(--r4-font-mono);
	}

	.property code,
	.dependency code {
		color: #c5ced1;
		font: inherit;
	}

	.property em {
		overflow: hidden;
		max-width: 160px;
		color: #8e999d;
		font-style: normal;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.property[data-property-kind='dynamic'] {
		border-color: #365f82;
	}

	.property[data-property-kind='handler'],
	.dependency.write {
		border-color: #705f38;
	}

	.dependency.read {
		color: #82b9ed;
	}

	.dependency.write {
		color: #efc66d;
	}

	.composition-empty {
		display: grid;
		min-height: 240px;
		place-items: center;
		align-content: center;
		gap: 6px;
		color: #8d969a;
		font-size: 0.68rem;
	}

	@media (max-width: 520px) {
		.composition-summary {
			grid-template-columns: repeat(2, 1fr);
		}

		.composition-summary div:nth-child(2) {
			border-right: 0;
		}

		.composition-summary div:nth-child(-n + 2) {
			border-bottom: 1px solid #41474a;
		}
	}
</style>
