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

`src/studio/types.ts` defines `r4.studio.snapshot` v2. A snapshot contains:

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
Semantic selection remains template-level, while a Canvas selection may additionally focus one
artifact-qualified runtime instance:

- a conditional branch may not currently be mounted;
- an each-block node may correspond to multiple runtime elements;
- an imported component remains a source composition boundary;
- a portaled or closed overlay may have no canvas element.

Canvas instrumentation preserves these one-to-zero, one-to-one, and one-to-many cases. It does not
infer identity from primitive names or DOM order.

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

Snapshots are schema v2 and include the exact structured compiler profile used to compile them. That
profile participates in the revision hash and lets transactions recompile under the same analyzer,
Svelte, IR, and primitive-module configuration.

## Phase 3 transactional Inspector editing

The Properties Inspector exposes `set-property` only when a selected R4 primitive already has an
unambiguous static scalar attribute. It supports quoted strings, finite numeric expressions, explicit
booleans, and boolean shorthand. It deliberately does not insert missing properties or replace
dynamic expressions, shorthand bindings, handlers, spreads, structured values, or imported
component props.

Edit planning reparses the exact snapshot with Svelte's public modern AST. Revision-local anchors
identify only the authored token to replace; Studio never prints the whole AST or reformats unrelated
source. The browser sends a semantic property intent rather than trusted text offsets. Inside a
per-document mutation queue, the project service:

1. stably reads and recompiles the current file;
2. rejects a stale revision without rebasing it;
3. replans the intent against the authoritative snapshot;
4. applies and validates the source transaction in memory;
5. rechecks the disk revision;
6. writes a same-directory temporary file and atomically renames it;
7. returns the new snapshot and an exact revision-qualified inverse transaction.

Undo and redo use those inverse transactions through the same authoritative service path. Switching
documents, disconnecting, or observing an unrelated external revision invalidates local history.
Static builds remain read-only. Portable Node filesystems do not expose an atomic content
compare-and-swap across unrelated editor processes, so a hostile write in the final check-to-rename
gap remains a documented local-development limitation; Studio never claims to merge that race.

## Phase 4 runtime Canvas identity

Trusted repository previews have a separate Studio-only compilation. The transform wraps exact
Semantic IR source ranges in DOM-free context boundaries and emits high-resolution source maps. Each
R4 primitive consumes the nearest boundary and places artifact, source-node, and runtime-instance
identity on its existing semantic root. Instrumentation therefore does not add DOM parents, alter
list content models, or disturb sibling- and direct-child layout behavior.

The immutable artifact token covers the exact source and build path. Studio accepts a Canvas marker
only when its token matches the selected trusted preview and that preview's source exactly matches the
current revision-qualified snapshot. The resulting semantic selection still contains document ID,
revision, and node ID; a runtime instance ID is only an optional focus within that authored node.

One source node may expose no targets, one target, or multiple targets and instances. Each-block
instances share the source node ID and receive distinct instance IDs. Imported components remain
opaque: only the primitive roots they emit inherit the imported boundary identity. Portaled Sheet
surfaces and backdrops retain identity in the Studio overlay host, and removing the overlay updates a
selected node to zero mounted instances.

Canvas `Select` mode captures pointer and Enter/Space activation before the preview application runs;
`Interact` mode leaves application behavior untouched. Canvas, Composition, Source, Semantic IR, and
Platform IR resolve the same semantic node. The instrumented preview remains normal Svelte SSR plus
hydration and is never enabled for an arbitrary approved workspace.

## Phase 5 shared intents and hardening

Inspector, Canvas, and trusted in-process automation now produce the same
`r4.studio.edit-intent` v1 contract. An intent contains a stable ID, a revision-qualified semantic
node reference, a declared producer origin, and one bounded `set-property` operation. It never carries
trusted source offsets. The automation adapter is a component-context capability, not a network or
cross-origin endpoint; callers that retry a logical operation must retain its intent ID.

The local service validates and canonicalizes every intent, binds the request route to its target
document, rereads the authoritative source, and replans through the Phase 3 transaction path. Intent
IDs are idempotency keys for the service session: an identical duplicate returns the retained result
while that result is still the current document revision, a superseded result fails closed, and reuse
with another canonical payload is rejected. Undo and redo accept only exact inverse transactions with
fixed-size capability IDs issued by that same service session. The bounded registries retain compact
fingerprints after detailed reconciliation results expire, never silently evict a visible history
capability, and reject new history-producing writes before capacity could invalidate existing undo.

Project protocol v2 treats a lost mutation response as uncertain. After a same-session reconnect, the
client polls the exact canonical intent or history transaction's explicit pending state and never
resends the write. A retained outcome is adopted only when its result revision is still authoritative.
A new service session, missing result, superseded result, or mismatched payload fails closed and
requires a fresh revision-qualified operation. Manifest rescans are serialized and coalesced, sequence
gaps trigger reconciliation, same-revision reconnects restore current freshness, and source reads
expose explicit retry states.

Each mutation attempt appends a service-owned audit record with session sequence, timestamp, document,
operation, producer label, revisions, outcome, and code. The latest 100 records are visible in the
Audit Inspector. Records deliberately omit source text and property values; producer labels describe
the trusted caller's declared origin rather than an authenticated security identity.

Properties explain why editing is disabled and reject empty or non-finite numbers. Inspector and
Scratch tabs implement roving Arrow/Home/End focus with labelled, focusable panels. Canvas Select mode
provides roving keyboard access to noninteractive primitive roots and restores normal application
focus behavior in Interact mode. Mutation status uses a persistent live region, and audit content wraps
inside mobile layouts.

These five browser-Studio phases are complete for the documented vertical slice. Structural editing,
dynamic-expression replacement, raw-offset automation, external automation endpoints, arbitrary
workspace execution, collaborative merging, and cross-process filesystem compare-and-swap remain out
of scope.

Actual native execution is not a numbered browser-Studio phase. It requires an R4 Host handshake and
real target runtime; simulations remain labeled as simulations until that boundary exists.
