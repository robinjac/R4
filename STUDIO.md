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

The first Phase 1 slice intentionally does not include a local filesystem service, arbitrary project
roots, source mutation, or runtime-instance instrumentation. Vite HMR provides read-only external
source updates for this repository while those boundaries are designed.

## Next phase

Continue Phase 1 by introducing the local project service needed to open arbitrary R4 workspaces:

1. Constrain filesystem access to an approved workspace root.
2. Incrementally discover source files and component boundaries.
3. Stream external file changes into revision-qualified snapshots.
4. Serve the project's actual SvelteKit application in an isolated preview.
5. Detect stale snapshots and project-service disconnects explicitly.

Do not add graphical mutation until project snapshots, conflict handling, and source preservation are
reliable end to end.
