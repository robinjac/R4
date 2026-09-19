# R4 Lynx backend experiment

This directory is an isolated backend harness, not an application authoring surface.

`bun run native:generate` compiles the real Svelte experiment at
`src/research/getting-started/counter.r4.svelte` into R4 Semantic IR, lowers that IR through the
Lynx backend, and writes `src/generated.tsx`.

`bun run native:build` then uses the official Rspeedy and ReactLynx toolchain to produce
`native/lynx/dist/main.lynx.bundle` for Lynx Explorer or an embedded LynxView. The experiment is
pinned to engine version 3.9 because the current public Rspeedy encoder rejects later engine targets;
this should be revisited independently of R4's backend contract.

ReactLynx is intentionally contained here. It is the first replaceable implementation of the R4
native backend contract, not part of R4's public component or state model. A direct Lynx framework
remains a research target because the public Lynx bundle toolchain currently centers ReactLynx.
