# NK1 multi-pass engineering execution report — 2026-11-03

## Ground truth and scoring

- Canonical repository: ailtron1ss-rgb/NK1.
- Working source baseline: workpass70-source @ eaf653d2229b8c032fe542ffb3215ff25ba69a93.
- Parent Engineering OS branch: aspect/neurok-engineering-os-20261103 @ 8fa7bf8023ed260a42ef6dd7815f7209617bf7a1.
- Published release: Neuro / NeuroKurisu0.1, 2026-10-19, asset Neuro_Kurisu_WORKPASS70_2026-10-19.zip, 135,290,615 bytes, GitHub-reported SHA-256 c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286.

The weighted functional engineering maturity remains **46%** and release readiness remains **25%**. These are baseline estimates, not consciousness scores. None of the feature PRs below has been merged into workpass70-source or verified in the published ZIP. PR #723 is merged only into the parent Engineering OS branch.

## Parallel branch ledger

| Stream | PR / branch | Implementation progress | Exact-head evidence | Remaining gate |
|---|---|---:|---|---|
| Engineering OS control plane | #716 / aspect/neurok-engineering-os-20261103 | 75% | Parent SHA 8fa7bf8023ed…; 10 workflows completed successfully | Independent review; child-stack reconciliation; canonical merge |
| Manifest safety | #717 / aspect/engineering-os-manifest-validation-20261103 | 85% | Exact head d7c3ad89f0fa…; Engineering OS workflow success | Rebase/stack verification against latest parent; adversarial review |
| Coordinator lock safety | #718 / aspect/neurok-os-lock-integrity-20261103 | 80% | Exact head 27f360e68d3b…; Engineering OS workflow success | Concurrent lease/restart stress tests; parent integration |
| Emotion restore integrity | #719 / aspect/affect-restore-integrity-20261103-v3 | 90% | Exact head ecaedf58569c…; 8/8 visible workflow runs success | Review and canonical merge; longer-term affect behaviour evaluation |
| Interoceptive precision | #720 / aspect/interoceptive-precision-allocation-20261103 | 70% | Exact head b97b4434d92b…; 15 visible workflows success, including Will/Hexis/perception and learning contracts | Wire allocator into the live cognitive cycle; paired baseline/variant evaluation |
| Donor provenance and integration plan | #721 / research/donor-source-intake-20261103 | 80% | Archive digests, 22 nested ZIP snapshots / 21 unique sources recorded; current doc CI green | Path-level license/SBOM checks and mechanism-by-mechanism integration decisions |
| Read-set freshness | #722 / aspect/neurok-os-readset-freshness-20261103 | 80% | Exact head f27b1bc46cdb…; focused read-set workflow and parent OS workflow success | Wire into mandatory patch admission; signed receipts or trusted provenance; independent review |
| Patch provenance / policy preflight | #723 / aspect/neurok-os-patch-sandbox-20261103 | 100% for parent-branch scope | Merged 2026-11-03 into parent branch as 8fa7bf8023ed…; 3/3 exact-head checks success | Not in canonical source; actual isolated patch apply, test sandbox and rollback remain unimplemented |
| Spatial MemoryOS2 recall | #730 / aspect/memory-spatial-recall-20261103 | 70% | Exact head 1e19ffdc5d07…; spatial regression workflow + runtime typecheck green; memory integrity, restore, unified runtime and gateway checks green | Finish remaining broad CI; paired retrieval-quality/latency probes; perception and avatar/world-model wiring |

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
- No recall uplift is claimed yet.

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
