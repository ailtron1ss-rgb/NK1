# AURORA Predictive Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an evidence-aware executive kernel over NK1's existing world predictors and integrate it into the canonical world decision projection.

**Architecture:** A pure bounded TypeScript policy consumes a forecast, a read-only evidence projection from the canonical grounded-world and existing predictor owners, plus optional observation candidates and resource budgets. `WorldSubsystemRuntime` remains the sole integration and persistence owner; AURORA returns advice and never performs external actions.

**Tech Stack:** TypeScript ESM, Node 22+ strip-types tests, existing GitHub Actions world-perception workflow.

**Spec:** `docs/superpowers/specs/2026-11-26-aurora-predictive-kernel-design.md`

## Global Constraints

- Keep `workpass70-source` as the base; do not target `main`.
- Do not create a second canonical world, memory, latent-state, or action owner.
- Do not add runtime dependencies or model downloads.
- Only the existing `ActionGateway` can authorize and execute external actions.
- Preserve evidence classes: observed, inferred/model-output, conflict, unresolved, and unknown.
- Keep sensing advice advisory; never call a sensor or message the user from this kernel.
- Persist only bounded AURORA telemetry under the existing advanced runtime snapshot.

## Review Focus

- Empty world state: must be unknown and must not inflate grounding confidence.
- Stale or future-dated evidence: must not be treated as fresh observed state.
- Source-less observed labels: must not qualify as grounded observations.
- High privacy or resource cost: must suppress sensing candidates.
- Malformed or restored values: must fail closed and remain finite/bounded.

---

### Task 1: Build the pure AURORA policy

**Files:**
- Create: `runtime/neuro-kurisu/src/organism/world/AuroraPredictiveKernel.ts`
- Create: `runtime/neuro-kurisu/tests/aurora-predictive-kernel.test.mjs`

**Interfaces:**
- Consumes: `AuroraDecisionInput` with forecast, canonical world signal, optional budget and sensing candidates.
- Produces: `AuroraDecision` with directive, reason, uncertainty metrics, bounded utility/confidence adjustments, horizon, and optional selected candidate ID.

- [x] Write seven public-seam behavior tests covering candidate choice, privacy/cost constraints, low-risk action, bounded verification bias, invalid inputs, and restore sanitization.
- [x] Run the focused test and observe the missing-method failure before implementing the kernel.
- [x] Implement a pure, dependency-free evaluator with finite clamps, bounded penalties, and no execution side effects.
- [x] Re-run the same focused test and verify all seven tests pass.

### Task 2: Integrate AURORA into the canonical world runtime

**Files:**
- Modify: `runtime/neuro-kurisu/src/organism/core/WorldSubsystemRuntime.ts`
- Create: `runtime/neuro-kurisu/tests/aurora-world-runtime-integration.test.mjs`

**Interfaces:**
- Consumes: canonical `GroundedWorldState.snapshot()`, `UnifiedLatentWorldState.currentLatent()`, `P27NeuralWorldFoundation.snapshot()`, `WorldModelEnsembleController.summary()`, and existing action forecast.
- Produces: `evaluateAuroraDecision(...)`; `predictForDecision(...)` includes AURORA's adjusted confidence/utility, directive receipt, and recommended horizon. Runtime snapshot/restore carries the bounded AURORA state.

- [x] Derive the evidence projection from fresh source-bound canonical world rows; treat empty/stale evidence as unknown.
- [x] Apply AURORA to `predictForDecision` without bypassing action arbitration.
- [x] Add runtime snapshot/restore wiring under `advanced.auroraKernel`.
- [x] Add integration tests for observe recommendation, decision output, and persistence round-trip.

### Task 3: Ship focused checks and an auditable integration record

**Files:**
- Modify: `.github/workflows/world-perception-integrity.yml`
- Create: `docs/superpowers/specs/2026-11-26-aurora-predictive-kernel-design.md`
- Create: `docs/superpowers/plans/2026-11-26-aurora-predictive-kernel.md`

- [x] Add exact path filters and a focused workflow test step.
- [x] Run local unit tests and remote exact-head runtime integration and syntax validation.
- [x] Record exact commit, changed-file list, pull request, and verified checks.

## Verification note

The exact-head world-perception workflow passed the AURORA unit and runtime integration suite (10/10) and ran the canonical runtime typecheck script successfully. That script reported `mode=node-strip-syntax-only files=747` and explicitly noted that semantic `tsc` validation was unavailable because the TypeScript compiler was not installed in the CI image.
