<!-- Stack.svelte -->
<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        gap?: Spacing;
        vertical?: boolean;
        align?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
        children: Snippet;
    };
    
    const { children, gap, vertical = false, align }: Props = $props();
</script>

<div
    style:gap={gap ? `var(--size-${gap})` : "0"}
    style:flex-direction={vertical ? "column" : "row"}
    style:align-items={align}
    style:flex-wrap="wrap"
>
    {@render children()}
</div>

<style>
    :host {
        display: flex;
    }
</style>
