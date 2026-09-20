# R4 v0.1 architecture

## Goal

R4 preserves application intent long enough for each target to choose an appropriate realization.
It promises the same application intent, not identical pixels or behavior.

The v0.1 flow is:

```text
real .svelte experiment
        |
        +---------------------> SvelteKit web compiler -> HTML/CSS/JS -> SSR/hydration
        |
        -> Svelte validation + modern AST -> R4 Semantic IR v1
                                                |
                                      platform policy projection
                                                |
                                  replaceable native backend API
                                                |
                              Lynx adapter -> ReactLynx -> Lynx bundle
```

The split web path is deliberate. Web output remains direct, semantic Svelte output rather than a
lowest-common-denominator native tree. The compiler projection analyzes the same source and is the
portable contract for non-web backends.

## Boundaries

### Semantic primitives

`src/lib/primitives` contains Svelte components that are the web implementations of R4 semantics.
`src/lib/manifest.ts` declares each primitive's domain, intent, and policy-facing target mapping.

The current set is intentionally small and experimental. It is evidence to evaluate in the
Workbench, not a permanently stable API. Layout uses parent-owned `gap`, padding, alignment, and
distribution. Margin is not public R4 vocabulary.

### Compiler

`src/lib/compiler` uses only public Svelte compiler APIs:

1. `compile(..., { generate: false, modernAst: true })` validates normal Svelte semantics and
   detects runes mode.
2. `parse(..., { modern: true })` supplies source-preserving syntax for R4 extraction.
3. Imports are resolved by binding, so aliases work and a same-named local component does not
   silently acquire R4 meaning.
4. The compiler recognizes a constrained portable subset and reports unsupported platform elements
   or syntax instead of guessing.

No Svelte fork or private analyzer import is used. Svelte does not currently expose its complete
binding analysis in the public AST, so v0.1 performs a narrow source-level dependency analysis over
known R4 state, derived state, props, handlers, and template expressions. The resulting IR records
explicit update edges instead of requiring runtime virtual-tree diffing.

The Vite plugin in `tools/r4-vite.ts` compiles `?r4-ir` imports at build time. Compiler code is not
shipped to the browser.

### Semantic IR

IR v1 is defined in `src/lib/compiler/ir.ts`. It contains:

- version and source metadata;
- semantic element domains and intent;
- normalized semantic props such as `activation`, `destination`, and `alternative`;
- source ranges and stable compilation-local node IDs;
- literal, expression, template, and handler values;
- state, derived state, props, constants, and effects;
- dependency-directed update edges;
- handler reads, writes, and normalized mutations;
- backend requirements;
- `if` and experimental `each` control nodes.

The IR does not contain DOM nodes, React elements, Lynx elements, Swift views, or Android views.

### Platform policy

`src/lib/policy.ts` turns semantic nodes into inspectable target-policy projections. Web is marked as
actual execution. Native projections are explicitly marked simulated until an R4 Host reports real
device output.

Policy is where `Link` becomes URL/history behavior on web and host navigation on native platforms,
or where `Button` receives target-specific input, focus, feedback, and accessibility behavior.

### Backend API

`src/lib/backends/types.ts` defines the replaceable backend contract. A backend accepts only R4
Semantic IR and returns files, requirements, and diagnostics.

The first adapter in `src/lib/backends/lynx.ts` proves:

- semantic containers lower to Lynx elements;
- text remains explicit Lynx `<text>` content;
- a Svelte `$state` binding becomes backend state;
- `$derived` becomes a targeted derived computation;
- `count++` becomes a direct state update;
- Button activation gets Lynx tap and accessibility traits;
- the generated implementation bundles with the official Rspeedy toolchain.

ReactLynx is isolated below this boundary. It is not visible to R4 applications and can be replaced.
The public Lynx bundle toolchain currently centers ReactLynx, so a direct Svelte/R4 Lynx framework
requires deeper engine/compiler integration research. The installed encoder supports engine targets
through 3.9; the native harness is pinned accordingly even though newer Lynx engine documentation
exists.

### Workbench

`src/workbench` is private application code. `src/research/**/*.r4.svelte` files are the actual API
experiments. Synchronized Vite globs load each component, source file, compiler artifact, and lazy
syntax-highlighting payload.

The Workbench currently supplies the first slices of API Lab, Layout Lab, Platform Lab, Semantic IR
Inspector, and Accessibility Lab. Its architecture can add real host/device sessions and performance
telemetry without replacing the experiment format.

## Portable subset

v0.1 supports:

- R4 primitives imported by name or alias from `r4`, `$lib`, or `$lib/index.js`;
- default-imported local `.svelte` components as explicit composition boundaries;
- static JSON-like props and dynamic expressions;
- text interpolation;
- `$state`, `$derived`, `$props`, and `$effect` dependency representation;
- inline handlers with simple assignment and arithmetic mutations;
- `if` and experimental `each` blocks.

It fails or warns for:

- raw HTML/native elements in portable experiment markup;
- unknown components that are neither R4 primitives nor default-imported `.svelte` compositions;
- spreads, actions, transitions, bindings, raw HTML, and other unsupported directives;
- component-scoped CSS in portable projection;
- interactions whose semantics cannot be inferred, such as clickable `View`;
- missing image alternatives, input labels, or action names.

Web execution can support more Svelte than the portable projection. A diagnostic means the source is
not yet portable; it does not require degrading the web implementation.

## Web behavior

The Workbench and experiments use SvelteKit's normal server and client compilation. `Page` emits a
semantic `<main>` and document metadata. `Button`, `Link`, `Image`, `Input`, and text roles lower to
appropriate HTML rather than generic divs. The build therefore retains SSR, hydration, progressive
HTML, browser URLs, keyboard behavior, and Svelte's targeted client updates.

## Deliberate omissions

- No permanent Svelte fork.
- No virtual DOM added above Svelte or native backends.
- No claim that browser device frames equal real native execution.
- No R4 Host, native capability ABI, navigation runtime, or production native build yet.
- No complete Svelte language lowering for native targets.
- No renderer mixing or GPU surface implementation yet; the semantic element model leaves room for
  future renderer requirements without exposing renderer brands in application code.

## Next research checkpoints

1. Compare direct Lynx framework integration with the contained ReactLynx adapter using startup,
   update, threading, accessibility, and bundle metrics.
2. Add an actual R4 Host session protocol and show device-reported trees beside simulations.
3. Resolve imported composition boundaries into linked or inlined semantic units for native lowering.
4. Expand expression and control-flow lowering without turning the compiler into a JavaScript
   interpreter.
5. Prototype navigation and one capability through an R4-owned ABI, independent of renderer.
6. Add source maps from generated backend artifacts back to `.svelte` ranges.
7. Test accessibility trees and keyboard/touch behavior on real platforms before stabilizing APIs.
