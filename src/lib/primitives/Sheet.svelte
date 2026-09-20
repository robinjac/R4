<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getContext, tick } from 'svelte';
	import { getStudioRuntimeAttributes } from './studio-runtime.js';

	interface Props {
		children?: Snippet;
		title: string;
		description?: string;
		open?: boolean;
		onclose?: () => void;
	}

	let { children, title, description, open = $bindable(false), onclose }: Props = $props();
	let dialog = $state<HTMLDialogElement>();
	let embeddedSheet = $state<HTMLDivElement>();
	const id = $props.id();
	const embedded = getContext<boolean>('r4:embedded-page') ?? false;
	const getOverlayHost = getContext<(() => HTMLElement | undefined) | undefined>('r4:overlay-host');
	const studioRuntimeAttributes = getStudioRuntimeAttributes();

	$effect(() => {
		if (embedded) {
			if (open) void tick().then(() => embeddedSheet?.focus());
			return;
		}
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function portal(node: HTMLElement) {
		const host = getOverlayHost?.();
		host?.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function close() {
		open = false;
		onclose?.();
	}

	function handleCancel(event: Event) {
		event.preventDefault();
		close();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (embedded && open && event.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if embedded}
	{#if open}
		<div {...studioRuntimeAttributes} class="embedded-overlay" use:portal>
			<div {...studioRuntimeAttributes} bind:this={embeddedSheet} class="embedded-sheet" data-r4-primitive="Sheet" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} tabindex="-1">
				<header>
					<div><h2 id={`${id}-title`}>{title}</h2>{#if description}<p id={`${id}-description`}>{description}</p>{/if}</div>
					<button type="button" aria-label="Close" onclick={close}>Close</button>
				</header>
				<div class="body">{@render children?.()}</div>
			</div>
		</div>
	{/if}
{:else}
	<dialog {...studioRuntimeAttributes} bind:this={dialog} data-r4-primitive="Sheet" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} oncancel={handleCancel}>
		<header>
			<div><h2 id={`${id}-title`}>{title}</h2>{#if description}<p id={`${id}-description`}>{description}</p>{/if}</div>
			<button type="button" aria-label="Close" onclick={close}>Close</button>
		</header>
		<div class="body">{@render children?.()}</div>
	</dialog>
{/if}

<style>
	dialog,
	.embedded-sheet { width: min(100% - 24px, 560px); max-height: min(82vh, 720px); margin: auto auto 0; overflow: hidden; border: 1px solid var(--r4-color-border-strong); border-radius: var(--r4-radius-lg) var(--r4-radius-lg) 0 0; background: var(--r4-color-surface-raised); color: var(--r4-color-text); padding: 0; box-shadow: 0 -18px 60px rgb(23 27 30 / 28%); }
	dialog[open],
	.embedded-sheet { display: flex; flex-direction: column; }
	dialog::backdrop { background: rgb(23 27 30 / 48%); backdrop-filter: blur(2px); }
	.embedded-overlay { display: flex; position: absolute; inset: 0; align-items: flex-end; justify-content: center; background: rgb(23 27 30 / 48%); pointer-events: auto; backdrop-filter: blur(2px); }
	.embedded-sheet { max-height: 82%; }
	.embedded-sheet:focus { outline: none; }
	:global([data-r4-platform='ios']) .embedded-sheet,
	:global([data-r4-platform='android']) .embedded-sheet { width: 100%; margin: 0; border-right: 0; border-bottom: 0; border-left: 0; }
	header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--r4-space-md); border-bottom: 1px solid var(--r4-color-border); padding: var(--r4-space-md); }
	h2 { margin: 0; font: var(--r4-type-heading); }
	p { margin: var(--r4-space-2xs) 0 0; color: var(--r4-color-text-muted); font: var(--r4-type-caption); }
	header button { min-height: 36px; border: 0; background: transparent; color: var(--r4-color-accent); font: var(--r4-type-label); cursor: pointer; }
	.body { min-height: 0; flex: 1; max-height: calc(82vh - 90px); overflow: auto; padding: var(--r4-space-md); }
	.embedded-sheet .body { max-height: none; }
</style>
