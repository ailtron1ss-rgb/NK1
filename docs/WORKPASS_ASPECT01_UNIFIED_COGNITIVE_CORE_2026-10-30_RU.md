# NK1 Aspect 01 — Unified Cognitive Core

**Date:** 2026-10-30  
**Source baseline:** `workpass70-source` at `ad564d1879028f00549be41ec5172a2f72e25897`  
**Work branch:** `work/nk1-aspect01-cognitive-core-hardening-2026-10-30`

## Mission

Make the cognitive core a single, causally traceable, restart-safe control loop without creating parallel owners for memory, goals, actions, or subsystem state.

The canonical operational sequence remains:

`observation → prediction → appraisal → attention → memory → goal → plan → action → outcome → learning → self-update`.

The architecture map, event fabric, cycle verifier, subsystem registry/facades and action gateway remain the existing authorities. This work pass hardens their shared state projection boundary; it does not introduce a second cognitive runtime.

## Source review

The current source tree already contains:

- `CognitiveArchitectureMap` with explicit subsystem ownership, dependency edges and feedback flows.
- `CognitiveSubsystemPorts` / `CognitiveSubsystemFacade` for dependency-inverted access to existing owners.
- `CognitiveFrame` and `CognitiveExecutionPlanner` for bounded signal routing and compute budgeting.
- `CognitiveEventFabric` plus the eleven-stage causal event spine.
- `UnifiedCognitiveCycle` for monotonic cycle closure and persisted cycle metrics.
- Core and runtime regressions for phase order, causal parent links, persistence, restart and ownership.

The production `OrganismCore.ts` is a very large file (about 1.32 MB in the Git tree). It contains the canonical cycle but cannot be safely rewritten as a broad refactor in this pass. Extracting orchestration from it must be incremental and protected by the existing source-level and runtime regression suite.

## Defect fixed in this pass

`UnifiedCognitiveSubstrate` is a bounded read-only projection, not a canonical owner. Its old `restore()` used nested object spreads over persisted input. That admitted malformed values and unknown properties into the runtime projection. Its `integrate()` accepted duplicate or decreasing ticks and did not guard its cycle counter against safe-integer overflow.

### Implementation

1. Restore now performs an allow-list projection for every nested domain.
2. Non-finite/malformed metrics fall back to domain defaults; finite metrics are clamped to `[0,1]`.
3. Counters accept only non-negative safe integers; invalid counters fall back to their defaults.
4. Mode, action and reason labels are bounded and reject control characters.
5. Unknown root/nested fields are not copied into the state.
6. Unknown schema versions fail closed before mutating the previous valid state.
7. Integration requires a positive safe-integer tick that strictly increases.
8. Integration rejects cycle-counter overflow before mutating state.
9. Returned snapshots remain detached from canonical projection state.
10. A dedicated regression test is registered in `package.json` and the cognitive-contract GitHub Actions workflow.

## Files changed

- `runtime/neuro-kurisu/src/organism/core/UnifiedCognitiveSubstrate.ts`
- `runtime/neuro-kurisu/tests/workpass617-unified-substrate-restore-integrity.mjs`
- `runtime/neuro-kurisu/package.json`
- `.github/workflows/workpass287-288-cognitive-contracts.yml`
- `runtime/neuro-kurisu/docs/CHANGELOG_CUMULATIVE_RU.md`

## Validation

The new test covers valid restore, corrupted counters and metrics, invalid labels, extra fields, unsupported versions, monotonic ticks, duplicate-tick non-mutation, counter overflow, finite action bias and detached snapshots.

The targeted command is:

```bash
npm run test:aspect01:unified-substrate-integrity
```

CI is wired to run this test on both push and pull request changes to the cognitive substrate, test or package.

**Status note:** creating the test and wiring it into CI is not the same as reporting it passed. The test is considered CI-verified only after GitHub Actions reports success for the resulting branch/PR HEAD.

## Remaining work for Aspect 01

### P0 — call-path and ownership closure

- Audit every writer of canonical organism state and eliminate duplicate mutable owners.
- Verify that each runtime path enters the same cycle boundary and that micro-cycles cannot forge action/outcome evidence.
- Verify all eleven stages are linked to the exact tick and source identities at runtime, not only in source-text tests.
- Keep action selection, approval and side-effect execution behind their existing canonical authorities.
- Ensure checkpoint and restore are idempotent across interrupted writes.

### P1 — incremental modularization

- Split the 1.32 MB `OrganismCore` by cohesive ownership seams, starting with observation assembly, appraisal/attention, memory/goal selection, planning/action and outcome/learning.
- Keep the core as composition root; extracted units receive narrow typed ports and must not import each other directly.
- Maintain an architecture map and enforce that every listed component exists and every dependency edge is valid.
- Remove superseded implementations only after call-site and persistence migration proof.

### P2 — runtime evidence

- Add a long-run deterministic cycle test with fixed seeds and bounded resources.
- Add restart-in-the-middle tests for each cycle phase and verify lineage restoration.
- Add independent checks that predicted, simulated, claimed and externally observed outcomes remain separate.
- Publish p50/p95/p99 tick latency, heap growth, checkpoint cost, cycle completeness and broken-lineage rates.
- Verify clean install, server startup and Android/Termux runtime without relying only on mocks.

## Acceptance gate for 100%

Aspect 01 is complete only when all of the following are true:

1. One authoritative owner exists for each writable cognitive domain.
2. All normal and reduced-resolution runtime paths pass through explicit boundaries.
3. The eleven-stage operational cycle is causally complete on real runtime executions.
4. Duplicate, stale, malformed and restored events cannot manufacture cycle completion or learning credit.
5. Restart and interrupted-checkpoint tests preserve state and lineage without duplication.
6. No parallel cognitive runtime or shadow source of truth is active.
7. The Core modularization is complete enough that subsystem ownership is enforceable and testable.
8. Long-run performance and reliability gates pass on desktop and target Android hardware.
9. The exact tested source SHA is included in the verified Release ZIP.

**Current result of this pass:** persistence projection restore and tick monotonicity are hardened; test and CI wiring are added. The wider Aspect 01 remains in progress.
