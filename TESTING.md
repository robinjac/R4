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

- 14+ compiler/backend unit tests;
- Svelte and TypeScript checks with zero errors and warnings;
- a static SvelteKit build plus package generation and `publint`;
- a real Rspeedy Lynx bundle at `native/lynx/dist/main.lynx.bundle`;
- Playwright Workbench tests in Chromium.

Rspeedy may print a non-fatal Node `MaxListenersExceededWarning`. The build is accepted only when it
still exits successfully and reports the generated bundle.

## Browser acceptance

Start the Workbench:

```sh
bun run dev
```

Open `http://localhost:3000` and verify:

1. The title is `R4 Workbench` and there is one main document landmark.
2. `Targeted reactivity` starts at count `0` and derived value `0`.
3. `Increment count` changes those values to `1` and `2` without a page reload.
4. Source, AST, Semantic IR, Platform IR, Output, and Diagnostics controls update the inspector.
5. Web, iOS, Android, macOS, and Windows controls update the preview frame and selected state.
6. `Adaptive grid` renders three cards on the web; its native unsupported diagnostics are expected.
7. `Interactive View` toggles between Closed and Open; its semantic and Lynx diagnostics are expected.
8. The browser console has no uncaught errors.

Repeat at 390 x 844 and 1280 x 800 viewport sizes. Confirm that navigation remains reachable, the
preview can scroll, and the page itself has no horizontal overflow. Using only the keyboard, confirm
that every Workbench button receives a visible focus indicator and can be activated with Enter or
Space.

## Static deployment acceptance

Build and preview the deployable artifact:

```sh
bun run build
bun run preview
```

Open `http://localhost:4173` and repeat the counter test. The static site is written to `build/`.
GitHub Actions deploys that directory with `BASE_PATH` set to the repository name.

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
