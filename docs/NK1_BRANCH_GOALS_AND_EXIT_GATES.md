# NK1 branch goals, shared brain contracts and exit gates

**Updated:** 2026-10-23  
**Purpose:** durable execution contract for the existing branch taxonomy. This is an engineering plan, not proof that every mechanism is live or that software has subjective consciousness.

## North-star outcome

Deliver one autonomous, persistent, self-correcting digital organism/personality in the Kurisu Makise direction. A successful runtime repeatedly closes this loop:

`Perceive → normalize and establish provenance → retrieve relevant memory → update working/self/user/world state → appraise drives and uncertainty → broadcast decision-relevant state → plan under goals, resource budgets and ethics → execute through the canonical ActionGateway → independently verify external consequences → learn from reward plus typed failure causes → propose a repair/candidate → evaluate on held-out evidence → promote with approval or roll back → consolidate memory → update identity, affect and embodiment`.

Each transition must preserve the event/interaction identifier, time, source class, uncertainty, cancellation/deadline and evidence reference where applicable. A response, simulated transition, API ACK, model self-report or test fixture alone is not external proof. This loop is a design target: only exact-head tests and live end-to-end evidence establish that the whole path runs.

## Active category branches: final responsibilities and definition of done

| Existing branch | Final subsystem responsibility | Required mechanisms | Exit gate before calling it ready |
|---|---|---|---|
| `feature/perception` | Convert text, voice, UI and world observations into one bounded observation contract. | Source/modality/time/confidence; plain-data normalization; freshness and stale-input rules; predictive error and uncertainty; full cycle must consume the detached normalized input, not just assert it. | Input adversarial tests pass; the same observation ID appears in the cognitive trace; malformed or stale input cannot trigger a tool or mutate core state. |
| `feature/memory` | One canonical owner of autobiographical, episodic and semantic memory; temporal/revision-aware retrieval and consolidation. | Provenance/lineage; valid-time and event-time; contradiction/duplicate handling; bounded query and output budgets; retrieval benchmarks; consolidation/forgetting and privacy-aware correction/deletion. | Same-corpus held-out retrieval beats the baseline with confidence intervals; no duplicate memories or silent history rewrite; restart/correction semantics pass. |
| `feature/learning` | Turn real outcomes into measured policy/skill improvement, not merely logged rewards. | Experience identity; replay admission; reward + prediction gap + typed failure-class diagnosis; targeted repair plan; skill-candidate generation; train/validation/holdout separation; independent multi-axis evaluation; regression gate; approval, versioning and rollback. | Exact-head suite passes; candidate beats current baseline on matched seeds/task families and held-out tasks; no safety or regression breach; rollback is demonstrated. |
| `feature/emotions` | Functional affective regulation, not a claim of biological or phenomenal feeling. | Interoceptive/homeostatic signals, appraisal, uncertainty and social meaning; calibrated outcome regulation; schema-valid episode/feeling inference; bounded influence on attention/action; safe restore. | Invalid episodes cannot change state; ablation shows affect signals add measurable useful behavior without destabilizing safety, personality or energy budget. |
| `feature/personality` | Stable character and self-model across dialogue, action, learning and restart. | Trait priors + changing state; identity continuity; predictive self-agency; goals/commitments/limitations; user-model/ToM with uncertainty; action vocabulary shared with the planner; outcome learning cannot credit unknown actions. | Identity/behavior continuity suite passes across restart, context shift and model/provider switch; calibrated uncertainty is visible; no claim of inner experience as evidence. |
| `feature/visual-embodiment` | Connect cognition to speech, listening, avatar expression and bounded physical/perceptual adapters. | Voice planning uses affect/continuity/grounding; STT/TTS overlap and cancellation policy; descriptor-validated command input; one gateway for side effects; Live2D/VRM state follows event/affect state; device-adapter errors remain explicit. | Mock integration and physical-device E2E both pass; no duplicate utterance/action on retry/restart; avatar/audio timing and interruption are measured. |
| `feature/feedback` | Turn external action results into evidence that can or cannot grant learning credit. | Pre/postcondition contract per action; source trust; fresh-before/fresh-after; explicit independent-observation verification mode; result snapshot; thresholds actually enforced numerically; ACK vs proof separated; event and receipt lineage. | Spoofed, stale, unverified, receipt-only and replayed proof produce zero independent credit; device/world postcondition E2E and restart reconciliation pass. |
| `feature/experiments` | Reproducible validation and delivery workflow, not production cognition. | Current Node runtime/actions; lockfile and deterministic install; exact-head suites; benchmark baselines, ablations, matched seeds, raw per-case results; runner-startup vs app-test failure classification. | Workflow executes real steps on the exact HEAD; clean install succeeds; benchmarks, regressions and runtime smoke produce retained outputs. A job with `runner_id=0` and zero steps is not a test result. |
| `feature/useful-functions` | Reusable cross-cutting primitives only. | Minimal shared contracts, canonical snapshot/normalization utilities, bounded math and serialization; exact behavior documented once. | Multiple callers consume the same helper without policy divergence; no duplicate domain owners or hidden side effects; consumers have regression coverage. |

## Integration and supporting branches

| Existing ref | Intended purpose | Rule |
|---|---|---|
| `integration` | Only convergence point for category PRs and cross-domain contract fixes. | Merge in small reviewable units; resolve helper conflicts once; run the cross-category suite against the resulting exact commit. Do not report isolated branch code as integrated into the full runtime. |
| `rebuild` | Clean architecture migration target and island consolidation. | Preserve one canonical owner per capability; prohibit accidental old-tree imports; prove the full runtime graph before deleting legacy paths. |
| `workpass70-source` | Full source-tree working reference and donor base. | Compare with the live branch before edits; do not confuse this source tree with the release artifact. |
| `planning/master-audit-roadmap` | This roadmap, progress scorecard and explicit gap tracking. | Keep goals, owners, dependencies, commit evidence, test truth and release truth aligned. |
| `main` | Stable release/publishing metadata. | Do not land active feature work directly here. Do not claim the release ZIP changed until its binary asset/hash is verified. |
| `workpass*` historical branches | Evidence, source donors, checkpoints and focused experiments. | Reuse only relevant mechanisms with licensing/provenance; do not create another branch per idea or move every historical head into active development blindly. |

## Cross-domain wiring contract — one brain, not parallel agents

1. **Perception → state:** the cognitive runtime consumes a detached, bounded observation; time/source/confidence remain explicit.
2. **Memory ↔ state:** retrieval returns relevant memories with provenance and revision lineage. A read never silently promotes or rewrites truth.
3. **Affect/homeostasis ↔ attention/decision:** energy, load, uncertainty, prediction error and social meaning may influence appraisal and action ranking, but their weights are bounded and separately ablatable.
4. **Self/user/world models ↔ goals:** proposed intentions cite state/evidence and capability; uncertain user intent is not treated as consent.
5. **Planner → ethics → gateway → embodiment:** all side effects go through the canonical final authorization path, with idempotency, deadline/cancellation and receipts.
6. **Outcome → P23:** only normalized verified evidence grants the appropriate learning weight. Record both reward and a compact typed failure class; raw free-form notes do not become durable learning data by default.
7. **P23 → candidate evaluator → lifecycle:** reflection proposes hypotheses; candidate generation does not activate them. Train/validation/holdout, independent evaluation, regression checks, approval and rollback remain separate gates.
8. **Consolidation → memory/self/voice:** accepted experience updates durable memory and continuity; affect/avatar follows the same state/event identity and must not invent a mood or external event.

The human-brain analogy is functional only: global-workspace/broadcast ideas inform shared access to decision-relevant state; predictive processing informs prediction-error handling; replay/consolidation informs memory and learning; homeostasis informs resource/drive regulation. These do not establish anatomical equivalence or consciousness.

## Sequence for the next engineering passes

1. **Finish integration prerequisites:** restore GitHub runner provisioning, bring each category head up to date safely, execute its new regressions and cross-category contracts. Do not merge drafts while exact-head jobs cannot run.
2. **Close the self-improvement loop:** make typed failure causes drive a concrete repair plan and candidate generator; verify provenance back to the original trace; enforce size/dependency/security filters; run isolated candidate and baseline on identical train/validation/holdout seeds; compare multi-axis metrics; promote only after approval and reversible versioning.
3. **Prove the loop on a real backend:** record provider/model identity, execute a bounded task, validate the external postcondition, restart the runtime, reconcile pending side effects, and demonstrate that accepted memory/skill/identity state survives without duplicated actions.
4. **Embodiment + endurance:** prove STT/TTS/Live2D synchronization on target device, then run soak, cancellation, thermal/resource budget and recovery tests. Report actual raw measurements.
5. **Release:** clean-room dependency install, reproducible package build, signed/hash-verified archive, rollback drill, updated release ZIP verified in GitHub Releases. Never substitute an ordinary `main` source commit for the binary release artifact.

## Progress accounting

### WorkPass461 — live branch-head reconciliation (2026-10-23)
Current open-draft PR heads are #79 `09b801e7` (learning), #80 `c365c48b` (perception), #81 `be344d05` (emotions), #82 `eff640e5` (memory), #83 `48e36266` (personality), #84 `927629a4` (visual embodiment), #85 `6c75864f` (experiments), and #87 `28c930ae` (feedback). Planning PR #88 is also open draft. The latest code includes evidence-based confidence revision with provenance limits; replay-safe goal lifecycle; bounded outcome fields; safer action sensing; and an explicit event-ID return from the unified cognitive-cycle boundary. These source/test changes are present on category branch tips, not merged to integration.
- Verification remains unchanged: exact-head suites confirmed passing 0/7, category PRs merged 0/7, release ZIP updated/hash-verified 0/1, readiness 46/100. Hosted jobs fail before step execution; a local clone was not possible because GitHub hostname DNS did not resolve in the execution environment.


- The October 23 source history now includes follow-up code/tests across all seven core categories plus the CI/experiments category. Beyond boundary hardening, Hexis-inspired changes now add residual evidence-based belief revision and a bounded audit to the existing `MemoryOS2`, replay-safe promotion receipts in P67, and plain-data-validated lifecycle input/restore in P68. The CI/experiments branch also audits Node.js 24 compatibility of first-party artifact actions. These are commits on branch tips, not complete integration.
- The repository’s overall engineering readiness remains **46/100**. Do not raise it based on code volume: the newly authored regressions still need execution on exact HEADs, cross-category integration evidence, and release-asset replacement/hash verification.
- Current evidence breakdown remains: category branches with implementation commits 7/7 (100%); branches with regression source 7/7 (100%); exact-head suites confirmed passing 0/7 (0%); category PRs merged to `integration` 0/7 (0%); release ZIP updated/hash-verified 0/1 (0%).
- For each category, report separately: (a) implementation change committed, (b) regression authored, (c) exact-head test execution, (d) end-to-end/benchmark evidence, and (e) merged/release state.
- Any job that never receives a runner is **unverified**, not green and not a failing code test. Any benchmark without an independently held-out baseline is exploratory only.
- No code or report may claim subjective consciousness from simulated affect, persistent identity or plausible conversation. The target is a progressively more autonomous, coherent and evidence-accountable digital organism.

## Research and donor intake policy

- **Hermes Agent Self-Evolution / GEPA (MIT components):** adapt trace-based diagnosis, targeted mutation, candidate comparison, size/semantic guards and reviewable promotion. Check the license for each tool/repository/component; Darwinian Evolver is AGPL-3.0 and is not to be copied into NK1 by default.
- **Letta / MemFS memory & dreaming:** adapt hierarchy, versioned memory editing, consolidation and review of memory restructuring, while retaining NK1’s canonical MemoryOS2 owner rather than adding a second store.
- **Voyager:** adapt feedback-guided repair, compositional skill retrieval and automatic curricula; validate on NK1 tasks rather than transplanting Minecraft-specific reward logic.
- **Neuroscience analogies:** use GNW/workspace, predictive processing, interoception/homeostasis, episodic replay and executive control as hypotheses for interfaces and ablations. They are not proof that the runtime is conscious or a reason to add biological mechanisms without measured benefit.

## Follow-up execution status (2026-10-23)

### Commits delivered to the existing category branches
- `feature/learning` — `780d774f4fb29963d99ad08bda51a84f5a39b263`: independent holdout gates for three learning-quality axes.
- `feature/perception` — `8a38fd74c10f1863da995692e334238e15e4849e`: safe unified-cycle checkpoint restore.
- `feature/feedback` — `45758ede29ee884cd2eaf3b24b5b7baf979fa923`, `4cacd0bb177dba5033f00d4b8d67fb972cfcd36d`: safe outcome and task-manifest intake.
- `feature/visual-embodiment` — `5e1fa2523b13f1e9596848e160fec89b5a3aace7`: strict body-state normalization on initialization.
- `feature/personality` — `6d0cb1a2d6eb9fe9c36a1f0b5e572e0696260892`: safe live self-agency observations.
- `feature/memory` — `14b12d738c35ba14891a2d474f8d23ccd6ecdfeb` (validated temporal retrieval) and `97d329bc208aa8c7e4097947070b32dd17718fd0` (guarded background semantic-index options).
- `feature/emotions` — `8c86aa1b315f1e73e44668d42a7e21585dec912e`: prototype-safe action calibration and lookup.
- No new dependencies were introduced by these changes. Code, regression additions and changelog notes are stored together in their owning branches.

### Evidence and delivery scorecard
| Measure | Current result | Meaning |
|---|---:|---|
| Target category branches with a new implementation commit | 7/7 (100%) | Code has been committed to category branches; this is not merged coverage. |
| Target branches with regression cases added | 7/7 (100%) | Regression source exists; it has not yet been executed on these exact heads. |
| Exact-head suites confirmed passing in this pass | 0/7 (0%) | Unverified, not green. |
| Category PRs merged into `integration` | 0/7 (0%) | PRs remain separate to respect branch ownership and avoid unverified merges. |
| Current release ZIP updated and hash-verified | 0/1 (0%) | `main` and the binary release artifact are unchanged. |
| Overall engineering readiness estimate | 46/100 (46%) | Preserve prior baseline until exact-head CI and end-to-end evidence exist. |

### Infrastructure blocker
- Representative exact-head runs: [P26 learning validation](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40000062972), [cognitive contracts](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40000505529), [verified outcomes](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40000767939), and [embodiment validation](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40000952156).
- Each inspected job finished with `runner_id=0`, blank runner name and zero steps. This is a runner-startup failure; it does not identify a failing assertion or prove the new code passes.
- Keep category PRs draft until a runner is provisioned and the owning test/typecheck plus cross-category contract suite execute on the exact SHA. Do not spend more runs retrying the same pre-step failure.

`main` and the binary release archive have not been changed. Release metadata was rechecked: stable tag `Neuro` still points to `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` (135,290,615 bytes; SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`); later prerelease `workpass70-hotfix1-2026-10-19` has `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip` (136,354,713 bytes; SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`). Neither binary contains the 2026-10-23 category commits. Available GitHub actions expose text-file commits and release metadata reads, but no binary release-asset replacement operation; the archive update remains blocked. Next highest-value step: restore a real runner, execute the new regression suites, then resolve any actual application failures before integration.

## WorkPass455 — Hexis-inspired cross-domain wiring and next passes (2026-10-23)

Hexis source documents were inspected for stratified memory/provenance, durable identity/worldview, resource-bounded observe-orient-decide-act/heartbeat, and subconscious observation versus conscious action. NK1 adopts those principles in existing owners; it does not clone Hexis's PostgreSQL/Python stack or create parallel owners.

Recent category changes, all still separate from integration:
- feature/memory WorkPass449: P65 belief evidence revisions are source-aware, duplicate-ID idempotent, contradiction-sensitive, auditable and restore-bounded.
- feature/personality WorkPass450: canonical self-agency restore cannot overwrite invariant keys from persisted data; corrupt state blocks identity integrity.
- feature/perception WorkPass451: RealityEvidenceLedger is bounded and uses stable identity so exact replay is idempotent; simulator and external evidence stay distinct.
- feature/emotions WorkPass452: action outcomes are calibrated by action × emotion × homeostatic-pressure band rather than leaking reward across mismatched states.
- feature/visual-embodiment WorkPass453: continuous affect channels use monotonic smoothing in the existing unified intent; audio-boundary visemes remain clock-driven.
- feature/feedback WorkPass454: built-in action contracts can be strengthened but their evidence thresholds and required observation/actuation flags cannot be downgraded.
- planning/master-audit-roadmap WorkPass455: records the shared evidence/decision lifecycle and next passes.

Regression sources were added/wired on the category branches; exact-head runtime/typecheck execution is still unconfirmed due runner startup failures. Per-pass details are in the owning branch CHANGELOGs and implementation notes.

### Fixed-order next passes
1. WorkPass456 — shared evidence-event identity (in progress): RealityEvidenceLedger now accepts an upstream eventId and rejects changed-payload reuse. Remaining: pass the same verifier-owned execution/decision ID from ActionGateway/postcondition into the reality ledger, P65 evidenceId and outcome/reflection; exact replay must not inflate evidence.
2. WorkPass457 — state-to-decision bridge: one bounded read-only context carries energy/load, prediction error, affect, uncertainty, identity integrity and memory freshness to the canonical planner. Drives influence ranking only; Ethics and ActionGateway remain authoritative.
3. WorkPass458 — held-out memory-to-behavior benchmark: a fixed RU/EN corpus proves retrieval changes expected responses/plans and improves grounded accuracy/recall without test-set leakage or unbounded latency.
4. WorkPass459 — complete self-repair cycle: typed external failure → causal diagnosis → targeted repair → staged candidate → isolated matched evaluation → per-axis holdout → approval/rollback → receipt-backed consolidation.
5. WorkPass460 — integration and release: obtain actual CI steps/logs, integrate reviewed category PRs in small units, test the common exact SHA, then rebuild, inspect and hash-verify the release ZIP.

The completion goal table above remains the canonical responsibility map. Do not merge divergent histories wholesale or raise readiness because files merely exist. Overall engineering readiness remains 46/100 until exact-head execution and end-to-end evidence support a change.
