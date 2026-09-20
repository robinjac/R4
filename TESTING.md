# R4 v0.1 system testing

## Prerequisites

- Bun 1.4.0
- Node.js 20.19+ or 22.12+
- Chromium for Playwright
- For native acceptance: Lynx Explorer or a LynxView host compatible with Lynx engine 3.9

Install dependencies and the browser once:

```sh
bun install
bunx playwright install chromium
```

## Automated acceptance

Run the complete release gate:

```sh
bun run verify
```

This must complete all of the following:

- 25+ compiler, backend, and Studio contract unit tests;
- Svelte and TypeScript checks with zero errors and warnings;
- a static SvelteKit build plus package generation and `publint`;
- a real Rspeedy Lynx bundle at `native/lynx/dist/main.lynx.bundle`;
- 17+ Playwright project Studio, Scratch Studio, and Workbench tests in Chromium.

Rspeedy may print a non-fatal Node `MaxListenersExceededWarning`. The build is accepted only when it
still exits successfully and reports the generated bundle.

## Project Studio browser acceptance

Start Studio:

```sh
bun run dev
```

Open `http://localhost:3000/studio/` and verify:

1. The project navigator discovers applications, compositions, primitives, and research fixtures.
2. Field Operations executes through the actual Svelte web runtime.
3. Selecting another project document updates the runtime and every inspector view.
4. Selecting a Composition node highlights its exact source and scopes Semantic and Platform IR.
5. iOS, Android, macOS, and Windows are labeled simulations rather than native execution.
6. Direct document URLs and browser back/forward restore the selected project document.
7. Scratch and Workbench links preserve the configured static base path.
8. The browser console has no uncaught errors.

## Scratch Studio browser acceptance

Open `http://localhost:3000/studio/scratch/` and verify:

1. The browser compiler reaches `Portable subset` for the starter source.
2. Diagnostics, Semantic IR, Svelte AST, and Snapshot views represent the same revision.
3. Replacing Button with another primitive and selecting Analyze updates the Semantic IR.
4. Invalid Svelte source remains in the editor and produces a source-located diagnostic.

Scratch analyzes drafts but does not execute or write them.

## Workbench browser acceptance

Start the Workbench directly:

```sh
bun run workbench
```

Open `http://localhost:3000` and verify:

1. The title is `R4 Workbench` and the primitive index contains all 33 manifest primitives.
2. Selecting a primitive updates Preview, Source, Composition, AST, Semantic IR, Output, and Diagnostics.
3. `?entry=counter-reactivity` runs state and derived-state updates without a page reload.
4. Web, iOS, Android, macOS, and Windows controls update the selected policy profile.
5. Hidden application and diagnostic fixtures remain available through direct `?entry=` links.
6. The browser console has no uncaught errors.

Repeat Studio and Workbench acceptance at 390 x 844 and 1280 x 800 viewport sizes. Confirm there is
no horizontal page overflow. Using only the keyboard, confirm controls receive visible focus and can
be activated with Enter or Space.

## Static build acceptance

Build and preview the deployable artifact:

```sh
bun run build
bun run preview
```

Open `http://localhost:4173/studio/` and `http://localhost:4173/` and repeat the Studio analysis and
Workbench primitive-selection tests. The static site is written to `build/`.

## Native Lynx acceptance

Build the native artifact:

```sh
bun run native:build
```

Serve it to a device on the same network if Lynx Explorer requires a URL:

```sh
python3 -m http.server 3001 --directory native/lynx/dist
```

Load `http://<computer-lan-ip>:3001/main.lynx.bundle` in a Lynx 3.9-compatible Explorer or LynxView,
then verify:

1. The counter page renders without a red screen or runtime exception.
2. Count and derived values begin at `0` and `0`.
3. Activating `Increment count` changes them to `1` and `2`, then `2` and `4`.
4. The action is exposed as a button with the accessible name `Increment count`.
5. Text remains legible and the action has at least a 44 px target.

Record the host OS, device or simulator, Lynx Explorer/SDK version, result, and any runtime logs. A
successful bundle build alone does not complete native acceptance.

## Package smoke test

After `bun run build`, verify the Node-safe entry:

```sh
node --input-type=module -e "const r4 = await import('./dist/node.js'); console.log(Boolean(r4.compileR4 && r4.lowerToLynx))"
```

The command must print `true`.
