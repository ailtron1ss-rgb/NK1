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

- The current working pass (WorkPass424–440) contains real commits across the pre-existing learning, perception, memory, emotion, personality, embodiment and feedback branches. That is implementation progress on branch tips, not complete integration.
- The repository’s existing readiness scorecard currently places overall readiness near **46/100**. Keep this score unchanged until stronger evidence exists; adding more mechanisms is not by itself a score increase.
- For each category, report separately: (a) implementation change committed, (b) regression authored, (c) exact-head test execution, (d) end-to-end/benchmark evidence, and (e) merged/release state.
- Any job that never receives a runner is **unverified**, not green and not a failing code test. Any benchmark without an independently held-out baseline is exploratory only.
- No code or report may claim subjective consciousness from simulated affect, persistent identity or plausible conversation. The target is a progressively more autonomous, coherent and evidence-accountable digital organism.

## Research and donor intake policy

- **Hermes Agent Self-Evolution / GEPA (MIT components):** adapt trace-based diagnosis, targeted mutation, candidate comparison, size/semantic guards and reviewable promotion. Check the license for each tool/repository/component; Darwinian Evolver is AGPL-3.0 and is not to be copied into NK1 by default.
- **Letta / MemFS memory & dreaming:** adapt hierarchy, versioned memory editing, consolidation and review of memory restructuring, while retaining NK1’s canonical MemoryOS2 owner rather than adding a second store.
- **Voyager:** adapt feedback-guided repair, compositional skill retrieval and automatic curricula; validate on NK1 tasks rather than transplanting Minecraft-specific reward logic.
- **Neuroscience analogies:** use GNW/workspace, predictive processing, interoception/homeostasis, episodic replay and executive control as hypotheses for interfaces and ablations. They are not proof that the runtime is conscious or a reason to add biological mechanisms without measured benefit.

## Current-session gate status (2026-10-23)

- 17 commits were added to existing category branches across WorkPass424–440, including reward-aware reflection, reason-coded repair suggestions, bounded live-input ingress and explicit independent postcondition proof.
- Regression files and changelog entries are present, but runtime execution/typecheck for these exact heads is unconfirmed while runner assignment fails before job steps. Keep affected PRs draft.
- PRs #79–84 and #87 remain drafts for their respective category changes. `main` remains unchanged. The binary release archive has not been updated in this pass.
