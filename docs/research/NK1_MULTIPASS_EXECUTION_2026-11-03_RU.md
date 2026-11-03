# NK1 multi-pass engineering execution report — 2026-11-03

## Ground truth and scoring

- Canonical repository: ailtron1ss-rgb/NK1.
- Working source baseline: workpass70-source @ 36e576da622c0eb3d55759bb086657048c0243c1.
- Parent Engineering OS branch: aspect/neurok-engineering-os-20261103 @ 8fa7bf8023ed260a42ef6dd7815f7209617bf7a1.
- Published release: Neuro / NeuroKurisu0.1, 2026-10-19, asset Neuro_Kurisu_WORKPASS70_2026-10-19.zip, 135,290,615 bytes, GitHub-reported SHA-256 c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286.

The weighted functional engineering maturity remains **46%** and release readiness remains **25%**. These are baseline estimates, not consciousness scores. The current source already contains the spatial MemoryOS2 index/holdout and interoceptive precision allocator, but none of the open bridge/engineering-admission/estimator-hardening PRs below has been merged or verified in the published ZIP. PR #723 is merged only into the parent Engineering OS branch.

## Parallel branch ledger

| Stream | PR / branch | Implementation progress | Exact-head evidence | Remaining gate |
|---|---|---:|---|---|
| Engineering OS control plane | #716 / aspect/neurok-engineering-os-20261103 | 75% | Parent SHA 8fa7bf8023ed…; parent registry/coordinator workflows green | Independent review; reconcile child branches; canonical source integration |
| Manifest safety | #717 / aspect/engineering-os-manifest-validation-20261103 | 85% | Exact head d7c3ad89f0fa…; parent Engineering OS workflow passed when checked | Rebase/reconcile against latest parent; adversarial review |
| Coordinator lock safety | #718 / aspect/neurok-os-lock-integrity-20261103 | 80% | Exact head 27f360e68d3b…; parent Engineering OS workflow passed when checked | Concurrent lease/restart stress tests; parent integration |
| Emotion restore integrity | #719 / aspect/affect-restore-integrity-20261103-v3 | Closed, not merged | Previous head ecaedf58569c…; 8/8 workflows were green before the branch was closed | Reopen/reconcile only if this work is still needed beyond the integrated source |
| Interoceptive precision allocator | Merged PR #720 / source commit 36e576da622c… | Integrated | Exact source head 36e576da622c…; safe own-data input parsing, getter non-execution and Proxy fail-closed regression; 7 source workflows green | Paired adaptive-vs-fixed behavioural evaluation and real-device thermal/energy soak |
| Donor provenance and integration plan | #721 / research/donor-source-intake-20261103 | 80% | Archive digests: 22 nested ZIP snapshots / 21 unique sources; updated inventory/scorecard | Path-level license/SBOM checks and mechanism-by-mechanism integration decisions |
| Read-set freshness child | #722 / aspect/neurok-os-readset-freshness-20261103 | Superseded | Earlier child head f27b1bc… was validated; replaced by fresh parent-based PR #753 | Do not integrate stale child; use #753 |
| Patch provenance / policy preflight | #723 / aspect/neurok-os-patch-sandbox-20261103 | Merged to parent only | Merged 2026-11-03 into parent branch 8fa7bf8023ed…; exact-head checks passed | Still not in workpass70-source; sandboxed apply/test, rollback and source integration remain |
| Spatial MemoryOS2 index + holdout | Integrated in workpass70-source @ 36e576da622c… | Implemented and tested | Current source includes frame-aware grid, map-consistency diagnostics, 10k stress and five-seed holdout tests; historical measured holdout was recall@10 0.00→1.00 on the earlier exact test head | Rerun diversified seed geometry on latest source; real P41/camera calibration holdout, full retrieval p95, temporal/semantic no-regression |
| Grounded P41→MemoryOS2 bridge | #746 / aspect/grounded-spatial-memory-source-20261103 | 90% | Exact head c588f54a361e…; focused bridge/Core tick + typecheck and 25 unique broad workflows green | Base is one source commit behind; revalidate against 36e576…; authenticated sensor provenance, unit/calibration validation, real-device soak and review |
| Patch read-set admission | #753 / aspect/neurok-os-readset-admission-20261103 | 90% | Exact head f019606e15b2…; admission 11/11, full neurok-os contract suite, CLI fresh-receipt allow + outside-symlink rejection, Engineering OS workflow green | Mandatory apply-hook integration, signed receipts/agent identity, sandboxed apply/test, post-apply verification and rollback |
| Interoceptive estimator input integrity | #756 / aspect/interoceptive-estimator-input-boundary-20261103 | 90% | Exact head 7d7a4c6895af…; 11/11 tests, runtime typecheck, allocator and estimator focused workflows plus unified runtime, WorkPass79 and NeuroCore checks green | Paired behaviour evaluation; test calibrated sensor coverage/partial-data weighting; real-device soak and independent review |

Branch percentages describe delivery of each isolated engineering task, not intelligence or readiness of the whole system. They do not alter the 46% weighted baseline until integration gates are passed.
Branch percentages describe delivery of each isolated engineering task, not intelligence or the readiness of the whole system. They do not alter the 46% weighted baseline until integration gates are passed.

## Implemented mechanisms in this pass

### Engineering OS and multi-agent safety

- Read-set receipts bind every task's declared repository dependency to SHA-256 content at an immutable Git base commit.
- Verification rejects changed/deleted dependencies and forged receipt digests while allowing unrelated commits if the read-set is unchanged.
- Diff preflight parses bounded textual patches and classifies them as denied, human-approval-required or reviewable.
- Manifest validation and lock reclamation are isolated child branches.
- Explicit limitation: these primitives do not yet intercept every filesystem write, authenticate agent identity, or provide an OS-level sandbox. Mandatory apply/verify integration remains a future step.

### Affect and interoception

- Emotion restore integrity rejects malformed own/inherited/accessor/proxy-shaped snapshots and protects canonical feeling-to-emotion lineage.
- Interoceptive precision allocates a finite attention budget across energy, thermal load, cognitive load and sleep pressure, exposes entropy/dominant-channel diagnostics and feeds attended prediction error into the estimator.
- CI validates code contracts; neither PR demonstrates that the mechanism improves emotional regulation or task success until paired behaviour tests exist.

### Spatial memory

- MemoryOS2 remains the sole canonical memory owner.
- MemorySpatialIndex is a disposable 3D uniform-grid index derived from spatialFrameId/spatialX/spatialY/spatialZ in MemoryItem2.context.
- Frame isolation, coordinate/radius bounds, query-cell limits, candidate budget and proximity ranking are enforced.
- Restore, deduplicated re-encoding, updateContext and forget/eviction maintain index consistency.
- Text-only retrieval is unchanged and spatial retrieval only activates for an explicit valid spatial query.
- Controlled spatial-retrieval uplift is now demonstrated on the synthetic five-seed holdout: baseline mean recall@10 0.00, spatial mean recall@10 1.00, delta +1.00 on every seed, and zero cross-frame or out-of-radius/unlocated results. This does not yet establish real-world perception recall or transfer. A separate 10,000-row index stress test measured p95 1.195 ms over 60 bounded top-64 spatial-index queries; this measures the derived index path only, not the complete MemoryOS2 retrieval or perception-to-action pipeline.

## Donor source choices

The archive inventory records Hexis, Will, Letta, Lumina, OWL, Superpowers, Agent0, AutoGPT, Microsoft Agent Framework, AutoGen, Chroma, DSPy, FAISS, Hermes, Hyperon, Langroid, llama.cpp, Mem0, OpenAI Agents, OpenClaw and other snapshots.

Already present in NK1: Hexis, Will, Letta, Mem0, Lumina and Hermes adaptation layers. Do not import parallel memory owners or duplicate orchestrators.

Next extraction priorities:
1. Will: interoceptive precision, bounded heartbeat and asynchronous completion inbox at tick boundaries.
2. Hexis: complementary fast episodic / slow semantic learning, replay, provenance and reviewable learning diffs.
3. Hermes + DSPy/GEPA: propose skill revisions from trajectories but require sandbox, independent evaluator, immutable holdout, canary and rollback.
4. eMEM / Chroma / FAISS: benchmark multi-index retrieval ideas against canonical MemoryOS2 before adopting any external engine.
5. Hyperon: prototype a bounded symbolic reasoning adapter only if it improves explainability and passes parity/latency gates.
6. llama.cpp: optional local inference provider; evaluate memory/thermal budget and model quality on target devices before making it a dependency.

License rules: archive ZIP hashes are recorded, but ZIP branch names do not prove upstream Git commit identity. AutoGPT platform carries PolyForm Shield constraints; AutoGen and OWL need path-level license review. No wholesale source copying is approved by this report.


### Pass 2 evidence update — 2026-11-03

- PR #735, child of #730: grounded P41 vision observation → MemoryFabric → canonical MemoryOS2 integration; only fresh, visible, explicitly observed vision positions are admitted; 90-second freshness window; exact-head focused bridge tests and runtime typecheck passed at `1e454ea31b09a4a8086b599dc1071c2a5026e10c`.
- PR #738, sibling of #730: five-seed spatial-vs-text synthetic holdout passed at `2444de57fb13d6cbc406e9ef6a20ba804364b865`; baseline recall@10 0.00, spatial recall@10 1.00, +1.00 delta on every seed, no cross-frame or out-of-radius false positives; runtime typecheck passed.
- Both remain open draft PRs stacked on #730. These tests establish retrieval and integration contracts, not calibrated real-world spatial understanding or general intelligence.

### Pass 3 evidence update — 2026-11-03

- Source baseline advanced to `36e576da622c0eb3d55759bb086657048c0243c1`. This source commit hardened `InteroceptivePrecisionAllocator` against getter/proxy input. Its 7 latest source workflows completed successfully.
- PR #756 extends that boundary upstream into `InteroceptiveStateEstimator.observe()`: only plain own-data observations are read; missing/accessor-backed channels fall back to the last prediction; untrusted Proxy input gets zero attention budget and an explicit diagnostic reason. Exact head `7d7a4c6895afb403ba136078d39b1383f5a549c6`: 11/11 tests, runtime typecheck, allocator/estimator focused workflows, Unified Organism Runtime, WorkPass79 and NeuroCore Core Regression all passed.
- PR #753 adds a fail-closed patch admission preflight. Exact head `f019606e15b2dd1b49765287e3442f926111eae0`: 11/11 admission tests, complete Engineering OS test suite, CLI syntax and symlink-containment smoke all passed.
- PR #746 connects producer-marked observed spatial positions to canonical MemoryOS2 at the live Core tick. Exact head `c588f54a361e8b4bcec78a0d1c1a1ddceefe4363`: 25 unique broader workflows passed. Its base SHA is now one source commit behind; do not merge it without fresh comparison/revalidation against `36e576...`.
- The spatial index and its stress/holdout tests are already present in the current source baseline. Earlier controlled five-seed results showed recall@10 0.00→1.00 on each seed; the current source holdout has since been strengthened with distinct 3D seed geometry, so those historical numbers must not be treated as a measurement of the new geometry until rerun.

## Next engineering passes

### Pass 1 — finish Engineering OS admission

**Goal:** make patch application evidence-aware, not merely well-formed.
- Stack #717, #718 and #722 onto the latest parent branch without losing parent #723 changes.
- Add a single admission sequence: fresh read-set → patch digest/provenance → path policy → isolated apply → exact tests → diff/receipt verification → rollback on failure.
- Keep destructive, credential, workflow and runtime-core paths human-gated.
- Add race, stale-context, symlink/path traversal, partial-write, process-crash and rollback tests.
- Merge to workpass70-source only after independent review and all exact-head gates.

### Pass 2 — spatial and embodied world memory

**Goal:** make spatial memories queryable from the same world frame used by perception and the selected avatar.
- Add perception adapters that normalize units and attach source, frame, timestamp, confidence and calibration provenance.
- Route visual/object/pose/landmark observations through canonical MemoryOS2 context.
- Connect world-model/affordance queries to the spatial retrieval option without allowing cross-frame comparisons.
- Build paired spatial-vs-text and spatial-vs-baseline datasets with five or more seeds.
- Measure recall@k, false-near matches, frame confusion, p50/p95 latency and memory footprint; benchmark at 1.6k and 10k records.
- Require positive task-relevant retrieval delta with no text/temporal regression before raising the memory score.

### Pass 3 — affect/interoception live wiring

**Goal:** turn the isolated channels into a closed regulatory loop.
- Connect precision allocation to current organism state, drive urgency, task demand and action selection.
- Preserve an auditable unweighted prediction-error baseline.
- Compare allocator vs fixed/equal allocation on identical seeds, tasks and resource budgets.
- Measure calibration, recovery, action quality, attention entropy, false alarms, CPU/RAM/thermal cost and sleep/restart behaviour.
- Require independent paired evidence before changing the 40% affect/interoception estimate.

### Pass 4 — consolidation and continual learning

**Goal:** unify episodic replay, semantic belief update and skill revision without a second source of truth.
- Compare current Hexis adapter with source archive mechanisms.
- Replay only provenance-valid episodes; isolate contradictory or low-confidence evidence.
- Route proposed memory/skill revisions through P23 / independent evaluator; optimizer must not approve its own changes.
- Require at least five complete paired holdout seeds, positive recall/transfer or utility delta, no forgetting regression and rollback proof.

### Pass 5 — autonomy, self-model and personality

**Goal:** make initiative observable, useful, consistent and interruptible.
- Join Will heartbeat/completion inbox to RuntimeClockScheduler and OrganismBus at one tick boundary.
- Keep internal activity separate from external speech; support user interruption, pause, resume, restart and resource budgets.
- Score initiatives for relevance, usefulness, false-positive rate, safety interventions, compute and social timing.
- Measure identity/personality consistency longitudinally across tasks and memory restore.
- Self-modification stays disabled until downstream effect is shown independently on holdout; no unverified proxy may promote itself.

### Pass 6 — embodiment and release

**Goal:** prove the same cognitive state drives voice, avatar and mobile runtime.
- Browser E2E for 2D/Live2D and 3D selection, state-driven expression, gaze, pose and lip motion.
- Android/Termux soak with audio interruption, reconnect, persistence and low-resource fallback.
- Preserve existing 2D/Live2D path while optional 2.5D/3D providers are independently licensed and validated.
- Release gate: clean-machine install/build, full regression, SBOM/path-license audit, archive parity, exact ZIP SHA-256 recomputation and real-device soak.

## Non-negotiable evidence rules

- Coded ≠ connected; connected ≠ tested; tested ≠ released.
- CI proves contracts and regressions only; it does not prove consciousness or a general intelligence level.
- No score increase from file count, architecture diagrams or unmerged PRs.
- No source change is called released without comparing it against the exact published ZIP.
- No self-improvement promotion without immutable holdout, independent evaluation and rollback.
