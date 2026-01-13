<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        padding?: { top?: Spacing; bottom?: Spacing; left?: Spacing; right?: Spacing } | Spacing;
        border?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean } | boolean;
        rounded?: { top?: Spacing; bottom?: Spacing; left?: Spacing; right?: Spacing } | boolean;
        background?: Background; 
        children: Snippet;
    };

    const fromBorder = (border: Props["border"]) => {
        if (typeof border === "boolean") {
            return border ? "1px solid var(--border-color)" : "none";
        }

        if (typeof border === "object") {
            return `
                ${border.top ? "1px solid var(--border-color)" : "none"} 
                ${border.right ? "1px solid var(--border-color)" : "none"} 
                ${border.bottom ? "1px solid var(--border-color)" : "none"} 
                ${border.left ? "1px solid var(--border-color)" : "none"}
            `;
        }

        return "none";
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
            return "var(--radius-s)";
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

    const { children, padding, border, rounded = false, background }: Props = $props();;
</script>

<div 
    style:border={fromBorder(border)}
    style:padding={fromPadding(padding)} 
    style:border-radius={fromRounded(rounded) ?? "0"} 
    style:background-color={typeof background === "string" ? background : undefined }
>
    {@render children()}
</div>