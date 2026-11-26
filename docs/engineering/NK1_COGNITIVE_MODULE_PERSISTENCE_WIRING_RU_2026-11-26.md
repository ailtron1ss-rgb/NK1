# NK1 — Cognitive Module Runtime: canonical persistence wiring

**Date:** 2026-11-26  
**Parent:** Draft PR #1210, `aspect/module-runtime-lifecycle-20261126`  
**This change:** `aspect/module-runtime-persistence-wiring-20261126`

## What this closes

PR #1210 introduced a lifecycle-managed module runtime and a checkpoint-store adapter, but the adapter still required a host to assemble the two pieces. This change adds `createCognitiveModuleRuntimePersistence()` as the single supported assembly point.

The factory:
1. wraps the caller's existing `JsonStateStore<PersistedOrganism>` with `CognitiveModuleCheckpointStore`;
2. injects that adapter into `CognitiveModuleRuntime`;
3. binds the checkpoint snapshot provider to `runtime.snapshotAll()`;
4. registers only the host-supplied module factories;
5. returns the wrapped canonical store and the module lifecycle manager.

## Required host ordering

- Construct the factory before constructing `OrganismCore` / `OrganismRuntime`.
- Pass the returned `stateStore` to the organism runtime. Do not keep using the unwrapped delegate.
- Let the organism owner load its canonical state first; the adapter hydrates module envelopes during that same load.
- Activate modules after the organism's canonical state has loaded.
- Stop modules before final organism shutdown when graceful module quiescence is required.

The adapter does not create a second durable writer. Module snapshots are staged in memory and projected under `system.cognitiveModuleRuntime` inside the same delegate save as the organism checkpoint.

## Failure semantics

A module snapshot failure is recorded in the bounded `snapshotFailures` list while the canonical organism save continues. The last successfully staged module envelope remains available; the failure is not silently represented as a fresh snapshot. A failure of the canonical delegate save still propagates to the organism owner.

## Verification

The new integration contract verifies:
- active module state is included in the same canonical save;
- a new host loads the checkpoint before module activation and restores the module state;
- snapshot failures remain visible in the canonical checkpoint without blocking the rest of the organism save.

This is host assembly support, not automatic injection into every existing `OrganismRuntime` constructor. Device power-loss soak and Android/Termux acceptance remain separate gates.
