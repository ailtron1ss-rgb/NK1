# Aspect 01 — Unified Cognitive Core: execution-path audit and repair (2026-10-30)

**Branch:** `cline/d0m1qzrh` (cut from `aspect02-world-perception-2026-10-29`, head `0081ba0ae`)
**Scope:** trace one real cognitive cycle from perception to reflection, repair the execution
path, and prove a complete deterministic cycle end to end.
**Status labels:** `IMPLEMENTED` (code exists and is wired), `OBSERVED` (measured in the run
recorded here), `UNRESOLVED` (open), `HYPOTHESIS` (not proven).

This pass does **not** claim consciousness, semantic recall, production readiness or user-level
learning. It claims only that the canonical runtime executes one connected, deterministic
cognitive cycle and that three specific lifecycle/ownership defects are fixed and covered by an
executing regression.

## 1. The real runtime path that was traced

Production entry point: `OrganismRuntime.step()` → `stepInternal()` → `OrganismCore.observe()` /
`feedback()`. There is no `OrganismBus` type in this repository; the equivalent canonical
contracts are:

| Concern | Canonical owner |
| --- | --- |
| Writable organism state | `OrganismCore.persisted` (`PersistedOrganism.system`, `.facets`, `.state`) |
| Causal cycle ledger | `CognitiveEventFabric` (core-owned instance) |
| Cycle completeness verdict | `UnifiedCognitiveCycle` (core owner + runtime operational envelope) |
| Reality vs simulation evidence | `RealityEvidenceLedger` (governance subsystem, core-owned) |
| Evidence bus | `RuntimeEvidenceBus` (runtime envelope) |
| Action gateway | `ActionGateway` (core-owned) |

Stage-to-owner map for one cycle (`OBSERVED` in the new regression):

| Stage | Producing code | Artifact consumed downstream |
| --- | --- | --- |
| perception | `observe()` observation intake, `MultimodalPerception`, `EmbodimentRuntime.sampleActive` | observation event, `ObservationInputAssembler`, reality-evidence `observation:*` row |
| prediction | candidate scoring + `predictionLedger` (`rewardPredictionId`) | prediction event, predicted utility |
| appraisal | `EmotionAppraisalEngine.appraise/inferFeeling`, homeostatic needs | appraisal event, `affect` specialist signal |
| attention | `GlobalWorkspaceSubstrateV2` (`buildWorkspace`), `CognitiveNetworkBus` | attention event (`broadcastId`), workspace frame |
| memory | `MemoryFabric.retrieveForCognition`, `MemoryOS2` | memory event (retrieval ids + exposed context) |
| motivation → goal | intrinsic motivation, `canonicalSelfAgencyAuthority`, goal selection | goal event (`selectedGoalId`) |
| planning | core governed candidate selection; `PlanEngine` in the runtime envelope | plan event (candidates), envelope plan steps |
| action | `CanonicalActionPolicyArbiter` → `EmbodiedActionExecutor` via `ActionGateway` | action event, embodied action |
| outcome verification | `RealityGroundingController.resolve`, `ExternalPostconditionVerifier`, `RealityShadowBridge` | outcome event, `realityGrounding.last` |
| learning | `feedback()` learning gate → B365/neural/prediction/world-model learners | learning event, resolved prediction error |
| reflection | `consolidateInternal()` → `OfflineConsolidation` + `consolidateLongitudinal()` (`P47MemoryMind.reflect`) | episode memories, compacted temporal graph, self-update event |


## 2. Defects found

### D1 `FAILED` → fixed: two owners of the reality-evidence ledger (silent evidence loss)

`OrganismRuntime` kept a private `RealityEvidenceLedger` while `OrganismCore` kept the canonical
one in `organismSystems.governance.realityEvidenceLedger`. Both were restored from the same
persisted field and both wrote `persisted.system.realityEvidenceLedger`. Whichever wrote last
erased the other's rows.

Measured before the fix (one runtime step with user text):

```
persisted total 6 classes {"derived":3,"simulator":3}     <- core's observation/outcome rows gone
```

The user's own perception (`user-reported`) never reached the canonical ledger, so
`externalCount` stayed at 0 and promotion gates (`claimAssessment`) under-reported independent
evidence. `tests/big-pass-162-runtime-integration.mjs` already failed on `externalCount >= 1`.

Repair: `OrganismCore.recordRealityEvidence()` is the only writer; the runtime no longer
constructs, restores or persists a ledger and `realityEvidenceLedgerSnapshot()` delegates to the
core owner. After the fix:

```
persisted total 8 classes {"derived":3,"simulator":4,"user-reported":1}
```

### D2 `FAILED` → fixed: cycle lineage could not survive a restart

`OrganismCore.cognitiveCycleAnchors` is process-local, and the causal fabric was only persisted at
the end of `feedback()`. A process that stopped between perception/policy selection and outcome
verification lost the anchors *and* the events, so the next `feedback()` emitted an outcome with
no parents.

Measured before the fix:

```
unified after restart-feedback {cycles:1, completeCycles:0, brokenLineages:1,
  meanStageCoverage01:0.5, lastMissingStages:["observation","prediction","action"]}
outcome parents [ { tick: 1, parents: [] } ]
```

Repair: the open cycle is made durable in `observe()` (fabric snapshot persisted with the anchor
ids), and `feedback()` recovers missing anchors with the new
`CognitiveEventFabric.stageAnchorsForTick(tick)` — the durable ledger stays the single record.
After the fix the interrupted cycle closes with `completeCycles:1, brokenLineages:0` and the
recovered outcome cites both the recovered action and prediction.

### D3 `FAILED` → fixed: outcome delivery was not idempotent

A second `feedback()` for the same cycle ran the whole learning path again and only then threw
`RangeError: cognitive cycle tick must strictly increase` from the cycle evaluator — a partial

### D4 `UNRESOLVED` (partially addressed): two parallel cycle ledgers/verdicts

`OrganismCore` and `OrganismRuntime` each own a `CognitiveEventFabric` and a
`UnifiedCognitiveCycle`, persisted as `system.cognitiveEventFabric` /
`system.runtimeCognitiveEventFabric` and `system.unifiedCognitiveCycle` /
`system.runtimeUnifiedCognitiveCycle`. The core ledger covers the cognitive cycle; the runtime
ledger adds the physical action envelope (embodied action, grounding, postcondition). Both now
verify complete and agree in the regression, but they remain two counters for "the same" cycle.

The payload contracts also diverged for the same stage names:

* `attention`: core recorded only workspace item ids, the runtime recorded `broadcastId`. Fixed —
  the core attention event now records `broadcastId` and `selectedCandidateIds`, so the decision's
  broadcast is recoverable from the canonical ledger.
* `memory`: core recorded retrieval hits only, the runtime recorded `cycle.memories` as
  "retrieved ids". These are different sets (`lastRetrievedMemoryIds` vs the `ConsolidatedMemory`
  context returned in `OrganismCycleResult.memories`). Fixed naming — the core stage records
  `retrievedMemoryIds`/`retrievedCount` **and** `exposedMemoryIds`/`exposedCount`, and the runtime
  envelope records `cycleMemoryIds`/`cycleMemoryCount`. Unifying `OrganismCycleResult.memories`
  semantics is still open.
* `plan`/`action`/`self-update`: the core records policy selection and identity coherence, the
  runtime records plan steps, embodied action and continuity. The regression asserts both and
  documents which owner is authoritative for which fact.

Closing D4 (one verdict, one ledger, or an explicit parent/child relationship between them) is a
larger refactor and is left `UNRESOLVED` rather than faked.

## 3. Proof that a complete cycle executes

`tests/aspect01-unified-cognitive-cycle.mjs` boots the real `OrganismRuntime`, runs real cycles and
asserts, per tick:

1. the canonical 11 stages exist as **one connected parent chain** (each stage cites the previous
   stage's event), in order: observation → prediction → appraisal → attention → memory → goal →
   plan → action → outcome → learning → self-update;
2. the runtime operational envelope independently verifies the same cycle as complete;
3. each stage's artifact matches what the next stage actually used (emotion tick, workspace
   `broadcastId`, retrieval/exposed memory ids, selected goal, selected candidate action, embodied
   action, grounding record, resolved prediction error, identity value);
4. both cycle owners report 2 cycles / 2 complete / 0 broken lineages;
5. reflection runs (`OfflineConsolidation` + `P47MemoryMind.reflect`) and the **next** cycle
   retrieves the consolidated experience (memory closes the loop);
6. a second runtime fed identical input reproduces the same ticks, internal action, world action,
   embodied action and stage sequence (determinism control);
7. a restart between perception and outcome still closes the cycle (D2);
8. a duplicate outcome delivery does not learn twice (D3);
9. the runtime and core read the same canonical reality-evidence ledger containing the
   `user-reported` perception (D1).

Recorded run (`OBSERVED`, Node 24.22.1, this container):

```
ASPECT01_UNIFIED_COGNITIVE_CYCLE_PASS
cycles runtime/core: 2 cycles, 2 complete, 0 broken lineages, coverage 1, continuity 1
evidence: total 24, externalCount 3, simulatorCount 12
reflection: memories 2, ingestedEvents 33, compressions 3
restartClosure: cycles 1, completeCycles 1, brokenLineages 0
determinism: ticks [1,2], actions ["respond","respond"]

## 4. What was run

| Check | Result |
| --- | --- |
| `node --experimental-strip-types tests/aspect01-unified-cognitive-cycle.mjs` | PASS (`OBSERVED`) |
| `tests/big-pass-162-runtime-integration.mjs` | PASS (was failing on `externalCount`) |
| `tests/big-pass-372-reality-gated-loop.mjs` | PASS |
| `tests/big-pass-164-large-cognitive-pass.mjs` | PASS |
| `tests/workpass319-cycle-order.mjs` | PASS (updated for the single-ledger contract) |
| `tests/workpass323-cognitive-loop-persistence-separation.mjs` | PASS |
| `tests/cognitive-cycle-boundary.mjs`, `cognitive-cycle-boundary-runtime-wiring.mjs` | PASS |
| `tests/operational-microcycle-finite-input.mjs` | PASS |
| `npm run audit:core-ownership` | PASS (`CORE_OWNERSHIP=PASS errors=0`) |
| `node tests/workpass84-script-integrity.mjs` | PASS (1796 scripts, 1421 local test refs) |
| `npm run typecheck` | PASS in `node-strip-syntax-only` mode (634 files); semantic `tsc` not available here |

## 4b. CI wiring status

The regression is registered as `npm run test:aspect01:unified-cognitive-cycle`. The GitHub
Actions workflow is **staged**, not installed: the automation identity that produced this branch
has no `workflows` permission, so GitHub rejects any commit that adds a file under
`.github/workflows/`. The exact workflow lives at
`docs/ci/aspect01-unified-cognitive-cycle.workflow.yml` and must be copied to
`.github/workflows/aspect01-unified-cognitive-cycle.yml` by a maintainer with `workflows`
permission. Its exact-head Actions conclusion is therefore `UNKNOWN`.

## 5. Unverified / limits

* No `npm ci` was possible in this container (no `node_modules`), so runtime typecheck runs in the
  script's strip-only fallback mode (`UNKNOWN` for full `tsc` semantics). The new workflow runs
  `npm ci` + `npm run typecheck` on GitHub Actions; its exact-head conclusion is not yet recorded.
* `tests/big-pass-270-full-cycle-integration.mjs` still fails on `B270 traits did not change`
  (observed drift ≈1.7e-4 per trait over 12 operational cycles with unverified feedback). The
  learning path runs (`learningUpdates=12`); the magnitude is gated by the unverified-feedback
  learning scale. Treating that as a defect or as a stale threshold is `UNRESOLVED`.
* Determinism is asserted for identical input in a fresh process pair, not across machines.
* Reflection cadence in production is wall-clock driven (`reflectionIntervalMs`, 1–45 min); the
  regression forces it explicitly through `sleepConsolidate()`.
* No claim is made that the cycle is *good* cognition — only that it executes, is causally linked,
  and is restart-safe.

## 6. Next queue

1. Close D4: single verdict/ledger relationship, or an explicit parent-child contract with one
   persisted counter.
2. Unify `OrganismCycleResult.memories` semantics (retrieved context vs compatibility projection)
   and its language-prompt consumer.
3. Measure learning magnitude on verified outcomes so B270-style thresholds are evidence-based.
4. Extend the cycle regression to a restart *mid-runtime-step* with the real file store.

## 7. Pass 2 (same day): open items closed

Pass 1 left four items open. This pass closed three of them and found a fifth, higher-value
defect while validating the first.

### D5 `FAILED` → fixed: `feedback()` used a third, undocumented reward scale

`feedback()` derived `success = .5 + reward * .5` (implying `reward ∈ [-1, 1]`) but then computed
`rawReward01 = (reward ?? success + .5) / 1.5`. Consequences:

* a strong positive reward (`reward: .75`) was learned as **exactly neutral** (`rawReward01: .5`);
* every negative reward (`-0.4`) was clamped to **0**, i.e. indistinguishable from the worst case;
* `rawReward01` could never exceed `2/3`.

Observed by wrapping the real call in the failing regression:

```
B270.learnFromOutcome args for feedback({success:1, reward:.75, surprise:.2})
  reward01: 0.5          <- intended high reward arrived as neutral
B270.learnFromOutcome args for feedback({reward:.48})
  reward01: 0.464        <- "near neutral" arrived as below neutral
```

Repair: one signed contract shared by the full path, the spine-only path and the neural path —
`rawReward01 = clamp(reward == null ? success : .5 + clamp(reward, -1, 1) * .5)`. The production
runtime is unaffected numerically because it already supplies an explicit
`learning.reward01` (0..1); direct `feedback()` callers and the neural reward gate are fixed.

`big-pass-270-full-cycle-integration.mjs` (failing since the WorkPass70 import because 12 cycles of
`.75` reward produced no trait movement) now passes **without editing the test**.

### D6 `FAILED` → fixed: memory evidence described a different cycle (or an older one)

* `persisted.facets.memory.lastRetrievedMemoryIds` was only overwritten when retrieval returned
  items, so a cycle with empty recall re-published the *previous* cycle's ids — into the memory
  stage evidence and into feedback reconsolidation.
* `OrganismCycleResult.memories` is the compatibility `ConsolidatedMemory` context, while the
  runtime envelope labelled it "retrievedMemoryIds". Both sets were called "retrieval".

Repair: the retrieval ids are always replaced per cycle; the cycle result now exposes
`retrievedMemories` (bounded `RetrievedMemoryRef[]`: id, ≤280-char summary, kind, confidence,
goal relevance, epistemic status); the memory stage records exactly those ids; and the language
organ narrates the retrieved set when present, falling back to the compatibility context otherwise.

### D7 `UNRESOLVED` → fixed: two owners could disagree silently about the same cycle

The runtime operational envelope and the core cycle each keep a `UnifiedCognitiveCycle`. Pass 1
proved they agreed in the tested path but nothing prevented divergence. Now every runtime tick
computes `system.runtimeCycleReconciliation`:

```
{ version, tick, envelopeComplete, coreTick, coreComplete, agreed, reason, at }
```

The envelope may not claim completeness the core did not prove for the same tick: the
`cognitive-cycle-completeness` evidence drops from `.95` to `.35` unless both agree, and a
divergence is surfaced through `markRuntimeAnomaly('cycle-verdict-divergence:…')` instead of being
averaged away. The core cycle stays the canonical verdict owner; the envelope keeps its distinct
physical-action responsibility.

### D8 → regression only: restart-mid-step now proven against the real file store

The pass-1 restart proof used `MemoryStateStore`, which cannot catch a missing flush. The Aspect 01
regression now writes a real `FileStateStore` state file after `observe()`, discards the process
state, reopens from disk only, and asserts the interrupted cycle still closes with
`brokenLineages: 0` and a two-parent outcome.

### Updated regression surface

`tests/aspect01-unified-cognitive-cycle.mjs` additionally asserts, per tick: the persisted verdict
reconciliation agrees with both owners, the memory stage cites exactly `cycle.retrievedMemories`,
retrieved summaries stay bounded, reflection-fed retrieval is identical in evidence and result,
reconciled complete cycles carry `.95` completeness confidence, and a disk-restored open cycle
closes. Recorded run: `ASPECT01_UNIFIED_COGNITIVE_CYCLE_PASS` with per-tick agreement, `reflection:
memories 2 / ingestedEvents 33 / compressions 3`, disk restart `completeCycles 1, brokenLineages 0`.

Additional suites executed after D5–D8 (all PASS unless noted):

```
organism-smoke, language-context-budget, workpass87:superseded-memory,
workpass80:memory-residency, p2684:memory-residency, big-pass-126 memory benchmark,
workpass91 memory-to-action, big-pass-110, big-pass-37/38/39/40/42 spine,
b1701-b2200 / b2201-b2500 / b721-b900 organism integration, big-pass-368,
workpass296, p2841 postcondition + runtime + migration, p2840 shadow/boundary/learning-gate,
p2842 active perception + calibration, big-pass-270 (all four), big-pass-272/273 families,
big-pass-291, big-pass-294 (both), big-pass-164/165, p23 true-learning / verified-outcome /
promotion-integration, p26 replay buffer, developmental-trajectory, workpass319, workpass323,
cognitive-cycle-boundary (+runtime wiring), operational-microcycle, typecheck (strip-only)
```

### Pre-existing failures recorded, not caused by this pass

Verified identical on the unmodified head:

* `tests/big-pass-91-unified-learning.mjs` — the fixture's `stateAfter` omits `lastAction`, so
  `CausalExperienceStream.recordOutcome` correctly refuses to mint an ungrounded transition.
  Fixture defect (`UNRESOLVED`), not a runtime defect.
* `tests/big-pass-92-sensorium.mjs` — `OrganismRuntime.captureCamera()` returns no
  `semanticVision` field even with a vision backend configured; the runtime→vision-backend wiring
  is `UNRESOLVED` (Aspect 02 territory).

### Revised next queue

1. Fix the runtime→vision-backend return contract (`captureCamera.semanticVision`) and the
   `big-pass-91` fixture, so both pre-existing failures stop being noise in the suite.
2. Decide whether the runtime envelope keeps its own cycle counter or becomes a pure view over the
   core verdict now that reconciliation exists.
3. Measure verified-outcome learning magnitude with the corrected reward scale (ablations, not a
   single fixture).
4. Repeat the disk-restart proof with an interrupted `OrganismRuntime.step()` (batch open at kill).

