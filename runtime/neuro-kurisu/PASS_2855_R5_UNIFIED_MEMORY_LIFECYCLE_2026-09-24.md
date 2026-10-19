# Neuro-Kurisu 35.26.0 / P2855 — R5 Unified Memory Lifecycle

Date: 2026-09-24

## Goal

R5 consolidates production memory lifecycle ownership without creating another memory store. `MemoryOS2` remains the durable canonical memory authority and `MemoryFabric` remains the canonical storage/retrieval facade. The new `CanonicalMemoryLifecycleAuthority` owns lifecycle orchestration: pressure-aware maintenance, bounded residency, and consolidation routing.

## Implemented

### 1. Canonical lifecycle authority

Added:
`src/organism/memory/CanonicalMemoryLifecycleAuthority.ts`

Responsibilities:
- canonical lifecycle orchestration;
- pressure-aware maintenance through `MemoryFabric`;
- P70 budget integration;
- consolidation routing through the existing `MemoryConsolidationController`;
- bounded diagnostics/state;
- persistence and restore.

### 2. Retrieval authority consolidation

The main `OrganismCore` text-retrieval path no longer reads `MultiTimescaleMemory` directly. It now retrieves through `MemoryFabric` / `MemoryOS2`, so the production retrieval path has one canonical authority.

`MultiTimescaleMemory` remains a compatibility/read-model surface populated from the canonical store.

### 3. Memory mutation authority consolidation

The following production mutations now route through `MemoryFabric` wrappers:
- epistemic revision;
- signal/reconsolidation updates;
- forgetting.

Direct `MultiTimescaleMemory.add()` calls in the production Core were removed from compatibility ingestion paths; compatibility ingestion now enters through the existing canonical substrate bridge.

### 4. Lifecycle authority integration

The main cycle and longitudinal consolidation path now use `CanonicalMemoryLifecycleAuthority` instead of calling `MemoryOS2.maintain()` directly.

The existing P70 governor and consolidation controller are preserved as specialized mechanisms under one lifecycle orchestration owner rather than becoming parallel lifecycle authorities.

### 5. Identity/autobiographical retention invariant fixed

A real lifecycle bug was found during R5 ablation: the `MemoryOS2` hard-cap pruning stage could remove `identity` or `autobiographical` memories before residency protection ran.

The hard-cap removable set now explicitly excludes:
- `identity`
- `autobiographical`
- `quarantined`

This was verified by a 1,482-item retention lesion test.

### 6. Persistence

Lifecycle authority state is included in `AdvancedDevelopmentFacet` and `MemorySubsystemRuntime` snapshot/restore.

## Evidence

### R5 authority

`R5 memory lifecycle authority: PASS`

- canonical item retrieval through MemoryFabric: PASS
- lifecycle maintenance: PASS
- consolidation routing: PASS
- lifecycle state snapshot/restore: PASS

### Retention / residency ablation

`R5 memory lifecycle ablation: PASS`

Input:
- 1,482 canonical memories
- low-value background memories
- protected identity memory
- protected autobiographical memory

After hard cap:
- 640 retained
- 842 removed/forgotten
- protected identity preserved
- protected autobiographical memory preserved

Residency after pressure:
- hot: 24
- warm: 96
- cold: 520
- materialized vectors: 120

### Retrieval regression

- memory dedupe: PASS
- memory substrate coordinator: PASS
- signal-fusion retrieval: PASS
- retrieval audit/provenance: PASS

### Existing architecture regression

R3:
- unified latent world: PASS
- ablation: PASS
- restart: PASS

R4:
- temporal credit authority: PASS
- ablation: PASS
- restart: PASS
- Core integration: PASS
- 10,000-iteration bounded performance: PASS

P2854 core integration:
- PASS
- tick 16
- persisted: true

P2855 / canonical policy:
- canonical policy arbiter: PASS
- live P2855 contribution: 7/7 actions
- contextual policy holdout: PASS
- organism policy integration: PASS
- policy ablation: PASS

B2521 runtime:
- PASS
- 10 cycles
- 280 rollouts
- 10 learning updates
- 10 transitions
- accuracy: 0.57117
- coverage: 0.42473
- counterfactual use: 0.25462

### Release integrity

- Typecheck: PASS
- Architecture audit: PASS
- Release contract: PASS
- Source hygiene: PASS
- Release source verification: PASS
- Lockfile audit: PASS
- Archive manifest: PASS

Current structural counts:
- canonical files: 532
- source files detected by architecture audit: 1,667
- source hygiene files: 3,679
- architecture cycles: 0
- missing canonical imports: 0
- legacy leakage: 0
- source hygiene errors/warnings: 0/0

## Runtime observation

20-cycle mobile-profile probe after R5:
- cycles: 20
- mean cycle: ~525 ms
- worst observed cycle: ~831 ms
- process MAXRSS during probe: ~592 MB

This is useful as a bounded regression measurement but is **not** a claim of mobile readiness. The previously failing/timeout-prone 80-cycle whole-organism autonomy test remains unresolved and is still an R7 target.

## Important limitation

The heavy standalone P2854 hierarchical transfer suite reached the external execution timeout during the combined P2855 regression batch. Its standalone P2854 core integration passed, and R3/R4 plus canonical policy suites passed independently. The heavy hierarchical suite is therefore not marked as verified in R5.

## Architecture direction after R5

Production causal path is now closer to:

`observation -> canonical memory retrieval -> cognition -> policy/action -> outcome -> temporal credit -> memory reconsolidation -> lifecycle maintenance/consolidation -> persistence`

The remaining major fragmentation is inside the broader specialized memory research stack (recent/prior replay, hippocampal/cortical experimental routes, autobiographical/semantic support). These remain bounded specialist mechanisms and are not declared a second canonical memory authority.

Next major target: R6 Self / Identity / Agency — hard constitutional identity invariants, plastic developmental traits, persistent self-state causally connected to decisions, and evidence-gated self-modification with sandbox/rollback if enabled.
