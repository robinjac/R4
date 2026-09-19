# R4 v0.1

R4 is a Svelte 5 research project for compiler-driven, cross-platform application UI.

Developers author ordinary `.svelte` components with R4 semantic primitives. The same source runs
directly through SvelteKit on the web and is separately projected into versioned R4 Semantic IR for
platform analysis and replaceable native backends.

This repository is intentionally a vertical slice, not a complete framework.

## What works

- Svelte 5 authoring with runes, snippets, TypeScript, and component composition.
- Twelve experimental semantic primitives: `View`, `Stack`, `Grid`, `Layer`, `Text`, `Image`,
  `Icon`, `Button`, `Input`, `Page`, `Scroll`, and `Link`.
- Direct semantic web output with SvelteKit SSR and hydration.
- Build-time Svelte validation and modern-AST extraction into R4 Semantic IR v1.
- State, derived-state, template dependency, mutation, effect, and targeted-update representation.
- Browser Workbench discovery of real `src/research/**/*.r4.svelte` experiments.
- Source, Svelte AST, Semantic IR, platform policy, generated output, and diagnostic inspection.
- Clearly labeled Web, iOS, Android, macOS, and Windows browser preview modes.
- A replaceable Lynx backend that lowers IR, generates an internal ReactLynx implementation, and
  produces a real Lynx bundle with Rspeedy.

## Commands

```sh
bun install
bun run dev
bun test
bun run check
bun run build
bun run test:e2e
bun run native:build
bun run verify
```

`bun run native:build` writes `native/lynx/dist/main.lynx.bundle`. Load it with Lynx Explorer or an
embedded LynxView that uses a compatible engine.

See [TESTING.md](./TESTING.md) for browser, static deployment, package, and native acceptance steps.

## Research workflow

Add an ordinary Svelte component under `src/research` using the `.r4.svelte` suffix. The Workbench
discovers its component, raw source, compiler artifact, and Lynx projection automatically.

```svelte
<script lang="ts">
  import { Button, Stack, Text } from '$lib/index.js';

  let count = $state(0);
</script>

<Stack gap="md">
  <Text>Count: {count}</Text>
  <Button onclick={() => count++}>
    <Text role="label">Increment</Text>
  </Button>
</Stack>
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for boundaries, current constraints, and next research
questions.
