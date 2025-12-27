<script lang="ts">
    import type { Snippet } from "svelte";

     type Props = {
        padding?: { top?: Spacing; bottom?: Spacing; left?: Spacing; right?: Spacing } | Spacing;
        border?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean } | boolean;
        radius?: { top?: Spacing; bottom?: Spacing; left?: Spacing; right?: Spacing } | Spacing;
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

    const fromRadius = (radius: Props["radius"]) => {
        if (typeof radius === "string") {
            return `var(--size-${radius})`;
        }
        
        if (typeof radius === "object") {
            return `
                ${radius.top && radius.left ? `var(--size-${radius.top})` : "0"} 
                ${radius.top && radius.right ? `var(--size-${radius.right})` : "0"} 
                ${radius.bottom && radius.right ? `var(--size-${radius.bottom})` : "0"} 
                ${radius.bottom && radius.left ? `var(--size-${radius.left})` : "0"}
            `;
        }

        return "0";
    };

    const { children, padding, radius, background }: Props = $props();;
</script>

<div 
    style:padding={fromPadding(padding)} 
    style:border-radius={fromRadius(radius)} 
    style:background-color={typeof background === "string" ? `var(--color-${background})` : undefined }
>
    {@render children()}
</div>

<style>
    :host {
        display: flex;
    }
</style>