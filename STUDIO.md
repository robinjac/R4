# R4 Studio

R4 Studio is the browser-first development environment for R4. Svelte source remains authoritative;
Studio views are derived from that source and never replace it with a proprietary project document.

## Phase 0 boundary

Phase 0 establishes contracts rather than pretending the complete editor or native runtime exists.

```text
R4/Svelte source
       |
       +-- browser worker -> Svelte validation -> R4 Semantic IR
       |
       +-- future source transactions -> source -> recompile
       |
       +-- future runtime bridge -> actual or simulated target session
```

The Phase 0 analyzer now lives at `/studio/scratch/`. It analyzes one in-memory document and exposes
diagnostics, Svelte AST, Semantic IR, and the complete compiler snapshot. Draft source is not
evaluated, written to disk, or rendered as a fake IR-driven canvas.

The existing Workbench remains at `/` and continues to execute trusted repository specimens through
normal Svelte compilation.

## Snapshot contract

`src/studio/types.ts` defines `r4.studio.snapshot` v1. A snapshot contains:

- the exact source analyzed;
- a normalized logical document ID;
- a SHA-256 revision over the source, document ID, compiler profile, and IR version;
- compiler diagnostics;
- Svelte syntax outline;
- R4 Semantic IR.

Semantic node IDs are unique only within one compilation. A Studio node reference therefore always
contains the document ID, revision, and node ID. A reference from one revision must never resolve
against another revision.

Source positions use one-based lines, zero-based UTF-16 columns and offsets, and exclusive end
positions. They refer to the exact source string stored in the snapshot.

## Selection contract

`src/studio/selection.ts` resolves semantic nodes and source ranges within an exact snapshot.
Selection is initially template-level rather than runtime-instance-level:

- a conditional branch may not currently be mounted;
- an each-block node may correspond to multiple runtime elements;
- an imported component remains a source composition boundary;
- a portaled or closed overlay may have no canvas element.

Future canvas instrumentation must preserve these one-to-zero, one-to-one, and one-to-many cases. It
must not infer identity from primitive names or DOM order.

## Source-edit contract

`src/studio/contracts.ts` defines source transaction v1 and the initial graphical edit capability
vocabulary. Transactions:

- target one exact document revision;
- contain UTF-16, end-exclusive text edits;
- reject stale revisions, invalid offsets, and overlapping edits;
- apply atomically;
- recompile into a new snapshot;
- generate an exact revision-qualified undo transaction.

The contract exists before graphical editing so Canvas, Inspector, and AI can eventually share one
safe mutation path. Phase 0 does not claim that all Svelte syntax is graphically editable.

## Runtime contract

The runtime protocol is versioned independently from Semantic IR. Runtime state is explicit:

```text
disconnected
connecting
connected / actual
connected / simulated
failed
```

Browser policy projection is not native execution. A native target may be labeled actual only after
a compatible R4 Host completes the runtime handshake.

## Security boundary

The Phase 0 analyzer runs in a lazy browser worker with Svelte `generate: false`. It parses and
analyzes source but does not execute user JavaScript, import draft modules, use `eval`, or inject raw
HTML. Source size is bounded, and stale worker responses cannot replace a newer request.

Filesystem access, process execution, project indexing, and native device access require a future
local Studio service with workspace confinement and explicit permissions.

## Phase 1 read-only project environment

`/studio/` discovers the repository's real `.r4.svelte` documents without converting them to a
Studio-owned format. The current project workspace provides:

- grouped application, composition, primitive, and research-file discovery;
- filterable project navigation and directly addressable document URLs;
- real trusted Svelte execution for the Web preview;
- explicit browser-policy simulations for iOS, Android, macOS, and Windows;
- source, Composition, Semantic IR, Platform IR, and Diagnostics inspectors;
- revision-qualified semantic-node selection shared by Composition, Source, Semantic IR, and
  Platform IR;
- links to the isolated Scratch analyzer and primitive Workbench;
- browser history and static base-path support.

The preview executes only trusted project modules discovered at build time. In-memory Scratch source
is still analysis-only. Native profiles are still simulations, regardless of their viewport or token
appearance.

The Phase 1 static path intentionally does not include filesystem authority, source mutation, or
runtime-instance instrumentation.

## Phase 2 local project service

During `vite dev`, Studio connects through Vite's existing loopback HMR channel to a versioned local
project service. The service:

- approves one workspace root at startup, using `R4_STUDIO_WORKSPACE_ROOT` or the Vite root;
- canonicalizes that root and never accepts a root from the browser;
- recursively discovers regular `.r4.svelte` files without following child symbolic links;
- skips generated and dependency directories and enforces depth, document-count, byte, character,
  and UTF-8 limits;
- performs stable, confined reads and creates revision-qualified compiler snapshots on demand;
- publishes external add, update, and removal manifests through HMR;
- periodically reconciles the manifest so dropped filesystem events cannot leave Studio stale;
- exposes connected, disconnected, stale, deleted, failed, and static freshness states;
- disables itself when Vite is exposed on a non-loopback host.

Static builds retain the trusted repository registry and do not contain filesystem authority. A
workspace other than the R4 repository is analysis-only: its source is never imported, evaluated,
injected as HTML, or rendered in the Studio origin. Known repository modules retain their actual
Svelte preview. An isolated arbitrary-project runtime remains a separate execution boundary.

Snapshots are now schema v2 and include the exact structured compiler profile used to compile them.
That profile participates in the revision hash and allows transactions to recompile under the same
analyzer, Svelte, IR, and primitive-module configuration.

## Remaining phases

Phase 3 adds the first writable path: capability-derived static-property edits, authoritative
compare-before-write transactions, exact undo/redo, and explicit external-change conflicts.

Phase 4 adds Studio-only runtime identity and Canvas selection without deriving identity from DOM
order or primitive names. It must preserve zero, one, or many runtime instances for one source node.

Phase 5 lets Inspector, Canvas, and automation share the same validated intent and transaction path,
then hardens reconnect, audit, accessibility, and full cross-phase acceptance behavior.

Actual native execution is not a numbered browser-Studio phase. It requires an R4 Host handshake and
real target runtime; simulations remain labeled as simulations until that boundary exists.
