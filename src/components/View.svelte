<script lang="ts">
    import type { Snippet } from "svelte";

     type Props = {
        padding?: { top?: Spacing; bottom?: Spacing; left?: Spacing; right?: Spacing } | Spacing;
        border?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean } | boolean;
        rounded?: { top?: Spacing; bottom?: Spacing; left?: Spacing; right?: Spacing } | boolean;
        background?: Background; 
        children: Snippet;
    };

    const fromPadding = (padding: Props["padding"]) => {
        if (typeof padding === "string") {
            return `var(--size-${padding})`;
        }
        
        if (typeof padding === "object") {
            return `
                ${padding.top ? `var(--size-${padding.top})` : "0"} 
                ${padding.right ? `var(--size-${padding.right})` : "0"} 
                ${padding.bottom ? `var(--size-${padding.bottom})` : "0"} 
                ${padding.left ? `var(--size-${padding.left})` : "0"}
            `;
        }

        return "0";
    };

    const fromRounded = (rounded: Props["rounded"]) => {
        if (typeof rounded === "string") {
            return `var(--size-${rounded})`;
        }

        if(rounded === true) {
            return "var(--radius-m)";
        }

        if (typeof rounded === "object") {

            return `
                ${rounded.top && rounded.left ? `var(--size-${rounded.top})` : "0"} 
                ${rounded.top && rounded.right ? `var(--size-${rounded.right})` : "0"} 
                ${rounded.bottom && rounded.right ? `var(--size-${rounded.bottom})` : "0"} 
                ${rounded.bottom && rounded.left ? `var(--size-${rounded.left})` : "0"}
            `;
        }
    };

    const { children, padding, rounded = false, background }: Props = $props();;
</script>

<div 
    style:padding={fromPadding(padding)} 
    style:border-radius={fromRounded(rounded) ?? "0"} 
    style:background-color={typeof background === "string" ? `var(--color-${background})` : undefined }
>
    {@render children()}
</div>

<style>
    :host {
        display: flex;
    }
</style>