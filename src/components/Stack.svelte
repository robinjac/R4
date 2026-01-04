<!-- Stack.svelte -->
<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        gap?: Spacing;
        vertical?: boolean;
        align?: "start" | "center" | "end" | "stretch"; 
        children: Snippet;
    };
    
    const { children, gap, vertical = false, align = "stretch" }: Props = $props();
</script>

<div
    style:display="flex"
    style:gap={gap ? `var(--size-${gap})` : "0"}
    style:flex-direction={vertical ? "column" : "row"}
    style:align-items={align}
    style:flex-wrap="wrap"
>
    {@render children()}
</div>
