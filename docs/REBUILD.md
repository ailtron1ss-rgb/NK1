# NK1 v2.0 — Rebuild charter and durable execution map

**Status:** ACTIVE REBUILD  
**Branch:** `rebuild`  
**Baseline:** `workpass79-cognitive-rebuild` at WorkPass93; source-only avatar/voice/Live2D audit at WorkPass94 is tracked separately.  
**Rule:** `main` remains the stable branch. Do not merge the rebuild until each island meets its Definition of Done.

## Mission and evidence discipline

Build a cohesive autonomous cognitive digital organism/personality inspired by Makise Kurisu. This is an engineering goal, not a claim that current software has subjective consciousness. Measure capabilities through reproducible behavior, independent baselines, recovery tests and live-device evidence. Never turn a synthetic test, source inspection, or passing CI into a claim of real-world cognition.

Every implementation commit must use `[NK1][stage] ...`, include behavior and regression coverage, and be followed by a CHANGELOG update. Record checkpoints with branch/head, exact commits, tests and logs, remaining gates, rollback path and next concrete work. Do not weaken tests to make a pass green.

## Six work islands

| Island | Scope | Required contract | Exit gate |
|---|---|---|---|
| 1. core | Cognitive cycle, workspace, prediction/appraisal, plan/act/reflect, policy ownership | versioned organism state + typed events | deterministic cycle tests, bounded execution, one-command start |
| 2. memory | working, episodic, semantic, procedural; revisions, retrieval, sleep-time consolidation | memory read/write/revision API + provenance | unit/integration/restart tests; independent RU/EN retrieval holdout |
| 3. motivation | energy, threat, curiosity, stress, confidence, decay and initiative scheduler | drive snapshot + initiative proposal | deterministic drive tests; autonomous initiative trace and 24h soak evidence |
| 4. embodiment | avatar, Live2D/VRM, speech, visemes, interruption, device bridge | versioned embodiment intent + speech event/clock IDs | UI build, browser E2E, interruption/remount, physical audio/device tests |
| 5. self | SelfModel, UserModel/ToM, metacognition, skill learning, temporal continuity | bounded self/user observations + evidence-backed updates | correction, transfer, retention, privacy and ethics tests |
| 6. validation | EthicalGate, observability, sandbox, CI, packaging, provenance, release gates | audit event + release evidence manifest | clean install, complete CI, rollback/security/soak gates |

These are work islands, not a claim that every desired capability is already implemented. Existing code is raw material; each retained behavior must be assigned one canonical owner and tested. A component stays isolated until its contract and exit gates pass.

## Twelve target layers and ownership map

1. **Cognitive core:** Global Workspace + predictive-error signals; owns Perceive → Appraise → Plan → Act → Reflect → Consolidate.
2. **Hierarchical memory:** four memory levels, revisions, evidence provenance and sleep-time consolidation; MemoryOS2 remains the only canonical memory owner until a validated replacement is ready.
3. **Self-learning:** skill proposals, execution/evaluation and promotion gating; no self-promoted skill without measured improvement over the current best policy.
4. **Motivation:** bounded homeostatic drives and initiative scheduling; drives influence proposals but never bypass EthicalGate or ActionGateway.
5. **Embodiment:** one state-to-avatar and speech event contract; browser speech and device speech must have explicit provider identities and correlated cancellation.
6. **Metacognition:** confidence, knowledge gaps and research triggers; reports uncertainty without inventing confidence.
7. **Social intelligence:** explicit, revisable UserModel/Theory-of-Mind hypotheses; no sensitive inference treated as fact.
8. **Temporal continuity:** elapsed time, episodic-to-semantic lifecycle and restart continuity.
9. **Ethical self-regulation:** intent verification, output/action gate, immutable audit evidence and safe rollback.
10. **Neurosymbolic reasoning:** typed facts/rules and bounded inference; symbolic outputs retain provenance and cannot override policy.
11. **Continual learning:** isolated candidates/adapters, held-out evaluation and anti-forgetting checks before promotion.
12. **Observability:** structured JSONL traces, health/readiness, latency/resource measures and actionable alerts.

The numbered layers are target architecture, not a count of completed features. Do not create duplicate owners simply to match this list.

## Old → new migration rules

- `runtime/neuro-kurisu/src/organism/OrganismCore.ts` and current runtime orchestrators → island 1 canonical core contracts; retain only tested ownership paths.
- `runtime/neuro-kurisu/src/memory/MemoryOS2` and related memory services → island 2 memory API; do not create a parallel store.
- Existing drive/agency/autonomous-loop modules → island 3, routed through core and ethics/action gates.
- `app/src/components/AvatarStage.tsx`, `app/src/components/avatar/embodimentTimeline.ts`, `app/public/live2d`, `runtime/neuro-kurisu/src/organism/body` → island 4 contracts; eliminate duplicate speech/expression owners only after regressions prove parity.
- Self/trait/UserModel, metacognition and skill modules → island 5 with explicit provenance, correction and promotion contracts.
- Existing scripts, workflows, audit reports, release manifests and docs → island 6; stale documentation is rewritten after its referenced behavior is replaced.

This is an initial ownership map grounded in current known source paths. File deletion requires reference/import/workflow/license/provenance checks and a same-commit replacement test. No bulk deletion based only on names or age.

## Execution order and current checkpoint

1. **Stage 0 — durable rebuild control plane:** this charter, architecture/roadmap, branch separation, checkpoint protocol and CHANGELOG entry.
2. **Stage 1 — core island:** inspect current ownership boundaries, create the smallest new canonical contracts/runtime slice, wire one executable cognitive-cycle test, and remove only the proven bypass/duplicate touched by that slice.
3. **Stage 2 — memory island:** memory API contract, four-tier mapping, revision/restart integration and independent retrieval evaluation.
4. **Stage 3 — motivation island:** drive state, decay, initiative scheduling, ethical preflight and initiative traces.
5. **Stage 4 — embodiment island:** fix audited expression/storage defects, unify speech correlation and wire browser/device E2E gates.
6. **Stage 5 — self island:** self/user models, metacognitive uncertainty, learning gate and temporal continuity.
7. **Stage 6 — validation island:** clean-room compose start, CI, security/licence/provenance, 24–72h soak, release manifest and migration cleanup.

## Definition of Done for every island

- New/changed code is reachable from the intended cognitive/runtime path, not a detached demo.
- Contracts are documented in `docs/` and enforced by runtime validation or TypeScript.
- Unit and integration tests reproduce the prior failure mode and assert the corrected behavior.
- One documented command starts the island; failures are explicit and actionable.
- Exact-head CI result is linked; live-device claims require actual device logs.
- CHANGELOG and a durable checkpoint are updated; all touched files have clear owners.
- Duplicate/legacy path is removed only after the replacement is verified; temporary bridges have a dated removal commit/gate.
- Rollback is a revert of the isolated stage commit(s), without rewriting `main`.

## Session continuation protocol

At each new session, read this file, `AGENTS.md`, the newest CHANGELOG entry and latest checkpoint; query live refs and Actions rather than trusting saved SHAs. Continue from the first unresolved gate, commit actual code plus regression, run focused commands, record exact evidence and proceed to the next logically dependent stage without asking for approval. Keep `main` and existing PR #1 untouched unless a separately justified release action is required.

## Current known release gates

- Exact-head validation of WorkPass93/94 and full app build are separate from source-level checks.
- Real browser Live2D rendering, physical speech, Android/Termux microphone/STT, interruption/remount/visibility and target-device performance are unproven.
- Independent labelled RU/EN retrieval uplift, transfer/anti-forgetting, live llama.cpp performance, restart-safe external actions, soak, clean install, rollback and release security remain open.
- Software behavior tests cannot establish subjective consciousness; the goal is a capable autonomous system with transparent evidence and bounded agency.
