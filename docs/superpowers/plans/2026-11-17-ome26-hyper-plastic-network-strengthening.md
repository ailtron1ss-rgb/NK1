# OME26 Hyper-Plastic Network Strengthening Implementation Plan

> **For agentic workers:** execute inline task-by-task with superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Make OME26 a signed-evidence-gated, resource-bounded hypernetwork experiment and connect its backend capability boundary to NK1's actual local provider.

**Architecture:** Reuse B292, CognitiveBudgetManager, VerifiedOutcomeLedger and SignedOutcomeArtifact. New evaluation records are signed and split-aware; raw caller metrics never mint a permit. Current llama.cpp chat provider remains explicit no-LoRA baseline.

**Tech Stack:** TypeScript/Node 24, node:crypto Ed25519/SHA-256, Node strip-types tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-17-ome26-hyper-plastic-network-strengthening-design.md`

## Global Constraints
- No base model weights are mutated.
- Only signed independent artifacts with process-local authentication receipts may affect promotion.
- B292 remains the only normalized cognitive-state source.
- CognitiveBudgetManager remains the single budget owner.
- Unknown backend capability means baseline-only.
- No automatic live promotion, secrets, external database, or Release ZIP mutation.

## Review Focus
1. A signed outcome without latency or safety metrics must not qualify for OME26.
2. A duplicate, incomplete, split-leaked or mismatched seed/task pair must not enter a measurement.
3. A restored plain ledger snapshot must not inherit authenticated evidence.
4. A changed adapter factor or base-model fingerprint must invalidate the evidence and route.
5. Budget rejection, sleep/defer mode or unstable cognitive state must prevent candidate generation before compute is charged.

---

### Task 1: Extend signed outcomes with optional execution metrics

**Files:**
- Modify: `runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomeLedger.ts`
- Modify: `runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomeArtifact.ts`
- Test: `runtime/neuro-kurisu/tests/ome26-hyper-plastic-network.mjs`

**Interfaces:**
- Add optional `metrics: { durationMs: number; safetyRegressionCount: number; peakMemoryBytes?: number; promptTokens?: number; completionTokens?: number }` to signed payload and verified ledger row.
- Validate finite, nonnegative bounded metrics at the ledger boundary; preserve old schema-v1 rows that omit the optional field.
- Signed canonical payload naturally covers metrics; ingestion persists them only after signature verification.

- [ ] Add a failing round-trip test for signed metrics and rejection of malformed metric values.
- [ ] Run the focused test and confirm the expected missing-metrics behavior.
- [ ] Add optional metrics to both contracts and preserve them in the detached accepted ledger row.
- [ ] Verify legacy v1 fixtures without metrics still pass existing tests.

### Task 2: Add signed split-aware OME26 evaluator

**Files:**
- Create: `runtime/neuro-kurisu/src/organism/research/HyperPlasticOutcomeEvaluator.ts`
- Modify: `runtime/neuro-kurisu/src/organism/research/HyperPlasticNetwork.ts`
- Modify: `runtime/neuro-kurisu/src/server/local-language-backend-policy.mjs`
- Test: `runtime/neuro-kurisu/tests/ome26-hyper-plastic-network.mjs`

**Interfaces:**
- Export `hyperPlasticMethodIdentity(kind, baseModelFingerprint, adapterFingerprint?)`.
- Export `measureHyperPlasticSignedEvidence(input, config)`; only complete validation/holdout rows with authenticated evidence count.
- Config pins ledger, manifest, baseline method, adapter method, target family and minimum seeds.
- Derive calibration and holdout fingerprints from disjoint manifest splits; never accept caller-computed scores.
- Evaluation produces an in-process evidence receipt. Only the signed-evidence evaluator may mint a route permit.

- [ ] Test raw report objects cannot mint a permit.
- [ ] Test valid signed validation/holdout pairs with five independent seeds.
- [ ] Test altered signatures, plain restored ledgers, mismatched model/adapter identity, incomplete tasks, duplicate seeds and split leakage.
- [ ] Implement SHA-256 identities and seed-level confidence/latency/safety gates.
- [ ] Keep synthetic report evaluator diagnostic-only or remove its permit authority.

### Task 3: Integrate budget-aware proposal bridge

**Files:**
- Create: `runtime/neuro-kurisu/src/organism/research/HyperPlasticRuntimeBridge.ts`
- Modify: `runtime/neuro-kurisu/src/organism/research/HyperPlasticNetwork.ts`
- Test: `runtime/neuro-kurisu/tests/ome26-hyper-plastic-network.mjs`

**Interfaces:**
- Bridge consumes `B292CognitiveStateBusState`, `CognitiveBudgetManager`, network, and exact model fingerprint.
- It estimates a `research` cost, checks `canSpend`, spends once, converts current B292 values to context, and generates a candidate.
- Rejection before generation must not spend; generation failure after accepted spend is recorded as a failed research attempt and cannot activate an adapter.
- Candidate is returned only as `shadow-candidate`, never as a live model update.

- [ ] Test defer/sleep/low-budget rejection has no adapter and no spend.
- [ ] Test an accepted proposal spends exactly once and uses B292 tick/readiness/stability.
- [ ] Implement bounded bridge and snapshot diagnostics.

### Task 4: Add truthful provider capability contract

**Files:**
- Modify: `runtime/neuro-kurisu/src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts`
- Modify: `runtime/neuro-kurisu/src/server/local-language-backend-policy.mjs`
- Modify: `runtime/neuro-kurisu/tests/ome26-hyper-plastic-network.mjs`
- Modify: `.github/workflows/ome26-hyper-plastic-network.yml`

**Interfaces:**
- Local provider returns frozen capabilities; current OpenAI-compatible chat transport reports `supportsLowRankAdapters: false` and no supported targets.
- The route resolver checks an exact provider-declared capability and the trusted signed-evidence permit.
- Do not add an adapter to the provider request unless a real loader contract exists.

- [ ] Test current provider fails closed; caller-injected capability values do not override provider-owned capability.
- [x] Implement immutable provider-owned capability objects and fail-closed route integration seam. The current chat provider explicitly reports no adapter loader.

### Task 5: Harden offline hypernetwork and final CI

**Files:**
- Modify: `runtime/neuro-kurisu/src/organism/research/HyperPlasticNetwork.ts`
- Modify: `runtime/neuro-kurisu/tests/ome26-hyper-plastic-network.mjs`
- Modify: `.github/workflows/ome26-hyper-plastic-network.yml`
- Modify: `docs/OME26_HYPER_PLASTIC_NETWORK_RU.md`

- [x] Add deterministic SHA-256 fingerprint and test finite tampering/collision-sensitive metadata.
- [x] Add global L2 gradient clipping, atomic bounded parameter updates, finite update checks, and checkpoint compatibility tests.
- [ ] Add signed-evidence test matrix and provider boundary integration.
- [ ] Run focused tests, runtime typecheck, and targeted source regressions.
- [ ] Inspect exact PR diff and exact-head Actions before reporting status.
