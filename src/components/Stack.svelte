<!-- Stack.svelte -->
<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        gap?: Spacing;
        vertical?: boolean;
        align?: "start" | "center" | "end"; 
        children: Snippet;
    };
    
    const { children, gap, vertical = false, align }: Props = $props();
</script>

<div
    style:display="flex"
    style:flex-grow="1"
    style:gap={gap ? `var(--size-${gap})` : "0"}
    style:flex-direction={vertical ? "column" : "row"}
    style:align-items={vertical && align ? align : "stretch"}
    style:justify-content={vertical ? "start" : align ?? "start"}    
    style:flex-wrap="wrap"
>
    {@render children()}
</div>
