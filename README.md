# R4 v0.1

R4 is a Svelte 5 research project for compiler-driven, cross-platform application UI.

Developers author ordinary `.svelte` components with R4 semantic primitives. The same source runs
directly through SvelteKit on the web and is separately projected into versioned R4 Semantic IR for
platform analysis and replaceable native backends.

This repository is intentionally a vertical slice, not a complete framework.

## What works

- Svelte 5 authoring with runes, snippets, TypeScript, and component composition.
- Thirty-three experimental semantic primitives spanning layout, content, actions, navigation,
  collections, forms, feedback, overlays, and structured text.
- Direct semantic web output with SvelteKit SSR and hydration.
- Build-time Svelte validation and modern-AST extraction into R4 Semantic IR v1.
- State, derived-state, template dependency, mutation, effect, and targeted-update representation.
- Browser Workbench discovery of real `src/research/**/*.r4.svelte` experiments.
- Source, Svelte AST, Semantic IR, platform policy, generated output, and diagnostic inspection.
- A browser-first Studio project environment with actual web previews and synchronized
  source, Composition, Semantic IR, platform policy, and diagnostics.
- A loopback-only local project service for confined workspace discovery, revision-qualified reads,
  external-change refresh, and explicit disconnect state during development.
- Capability-derived static-property editing with source-preserving transactions, stale-conflict
  rejection, and exact undo/redo through the same local service.
- Source-derived Canvas selection with DOM-transparent runtime identity, zero/one/many instance
  tracking, opaque imported boundaries, portal support, and separate Select/Interact modes.
- One validated, versioned edit-intent path for Inspector, Canvas, and trusted in-process automation,
  with at-most-once reconnect reconciliation and service-issued undo/redo capabilities.
- A bounded, metadata-only mutation audit Inspector plus roving tab and Canvas keyboard navigation.
- An isolated Scratch analyzer with revision-qualified source, AST, IR, and diagnostics snapshots.
- Clearly labeled Web, iOS, Android, macOS, and Windows browser preview modes.
- A replaceable Lynx backend that lowers IR, generates an internal ReactLynx implementation, and
  produces a real Lynx bundle with Rspeedy.

## Commands

```sh
bun install
bun run dev
bun run workbench
bun test
bun run check
bun run build
bun run test:e2e
bun run test:e2e:service
bun run native:build
bun run verify
```

`bun run dev` opens the project Studio at `http://localhost:3000/studio/`. The Scratch
analyzer is available at `http://localhost:3000/studio/scratch/`; it analyzes in-memory source in a
browser worker and does not execute or write the draft. `bun run workbench` opens the primitive
Workbench at `http://localhost:3000/`.

Set `R4_STUDIO_WORKSPACE_ROOT=/absolute/project/path` before `bun run dev` to approve a different
workspace. External workspaces are analyzed but not executed. The project service is unavailable in
static builds and when Vite is bound to a non-loopback host.

The Properties Inspector can update existing static scalar attributes while the local service is
connected. Dynamic expressions and structural edits remain source-only; stale edits are rejected
rather than silently merged.

Canvas property controls and trusted in-process automation use that same semantic intent path. Lost
responses are reconciled only within the same local service session and are never handled by replaying
the write. The Audit Inspector records operation outcomes and revisions without source or property
values.

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

See [ARCHITECTURE.md](./ARCHITECTURE.md) for framework boundaries and [STUDIO.md](./STUDIO.md) for the
completed browser-Studio phase contracts and deferred capabilities.
