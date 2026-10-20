# NeuroCore — persistent project charter and resume contract

**Canonical project name:** NeuroCore / нейроядро  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Active work branch:** `workpass79-cognitive-rebuild`  
**Primary intent:** build one cohesive, genuinely functional, memory-rich, learning-capable, adaptive digital organism/personality, with Makise Kurisu as the intended identity/persona direction. The historic `Neuro-Kurisu` name in directory paths is lineage, not a separate project.  
**This document is the durable instruction for future work. Read it before starting a new pass.**


## Latest durable checkpoint — WorkPass94 (2026-10-20)

- Active branch: `workpass79-cognitive-rebuild`; open draft PR: https://github.com/ailtron1ss-rgb/NK1/pull/1.
- Read `docs/WORKPASS94_CHECKPOINT_2026-10-20.md` for the strict verification-input binding change, commit links, evidence status and next tasks.
- `OutcomeVerificationService` now compares the complete expected action input using canonical structural serialization; partial inputs and mismatched nested values fail closed.
- Focused regression and CI workflow are added. Exact-head CI and the broader runtime typecheck/regression suite remain pending until observed.
- Refresh the live branch head, PR state and exact-head Actions status before continuing.

## 1. North-star outcome

The goal is not to accumulate modules or produce an impressive architecture diagram. The goal is a single integrated runtime whose capabilities are connected and externally testable:

- A real language model provider path, prioritizing the configured local `llama.cpp` endpoint when healthy and reporting which provider actually generated each answer.
- Persistent autobiographical, episodic, semantic, procedural, social and identity-relevant memory with provenance, time validity, revision, conflict handling, selective forgetting and restart recovery.
- Learning that transfers to unseen tasks and changes future behavior only when supported by verified outcomes; anti-forgetting and interference must be measured.
- Bounded goal-directed behavior with explicit permissions, cost/risk limits, cancellation, action receipts, independently verified postconditions and restart-safe reconciliation.
- Stable behavioral/personality continuity across sessions without treating a persona prompt or self-report as evidence of inner experience.
- Real embodiment integration: UI, browser, voice/TTS interruption, Live2D, lifecycle/reconnect and target-device behavior.
- Maintainable packaging, dependency ownership, reproducible builds, security/privacy boundaries and recovery after process failure.

**Do not claim that consciousness, subjective experience, human-level intelligence, independent agency or a completed digital organism has been achieved without independent evidence.** The project may investigate these questions, but the honest status is UNKNOWN / UNRESOLVED until defensible criteria exist.

## 2. Hard engineering rules

1. **Code-first:** make a concrete change to the owning implementation, not a decorative facade. Every meaningful change needs a regression that would fail before the fix.
2. **One canonical owner per capability:** do not add a second memory store, action gateway, truth ledger, provider selector or duplicate function merely to avoid changing the owner.
3. **No fake progress:** module counts, generated text, deterministic fallback, synthetic fixture results and self-reported scores are not proof of learning or autonomy.
4. **Evidence before promotion:** use baselines, ablations, counterfactuals, independent holdouts, leakage checks, uncertainty intervals and recovery tests. Keep raw per-case outcomes.
5. **Preserve before deleting:** inspect imports, tests, workflows, package scripts, manifests, license/provenance, assets and restore paths. Archive candidates reversibly; never delete because names look similar.
6. **Fail safely:** bounded inputs/outputs, timeouts, cancellation, privacy minimization, deterministic degraded behavior and clear provider/error provenance.
7. **Use real target constraints:** the user's test machine is a Dell G3 laptop with Intel i5 and GTX 1650; mobile deployment must remain mindful of Poco M7 Pro 5G / 8 GB RAM and battery/thermal constraints. Do not claim performance without measuring it on the named device.
8. **Do not silently merge branches:** continue on `workpass79-cognitive-rebuild`; inspect branch history and CI before proposing a merge to `main`.
9. **Report exact evidence:** label findings `PROVEN`, `IMPLEMENTED`, `FUNCTIONAL INDICATOR`, `OBSERVED`, `HYPOTHESIS`, `UNKNOWN`, `UNRESOLVED` or `FAILED` accurately.
10. **Skip blockers intelligently:** continue independent work when a device, registry, secret, external service or hardware test is unavailable; record the blocker and exact reproduction steps instead of fabricating results.

## 2A. Research, upstream source and integration mandate

Research is a continuous engineering input, not a documentation-only activity. For each high-impact subsystem and for the organism as a whole, actively examine current and historical papers, benchmarks, open-source implementations, issue discussions, model cards, licenses, reproducible reports and experimental mechanisms—even when approaches appear incompatible.

For each candidate:
1. Record the canonical upstream URL/repository, commit or release, date checked, license, provenance, dependency footprint, hardware assumptions and exact files/functions worth studying.
2. Separate claims into reproduced results, author-reported results, implementation observations, hypotheses and unknowns. Do not treat a paper abstract, README, benchmark headline or source code presence as proof.
3. Compare against NeuroCore's actual owner and failure mode. Map the proposed mechanism to existing code paths, data contracts, state ownership and resource budgets before integrating it.
4. Prefer a minimal adapter or a reversible isolated experiment. Preserve attribution and licenses; do not paste large upstream code without license compatibility and provenance.
5. Write a regression/ablation that tests the hypothesized benefit and failure modes, including latency, memory, privacy, interference, forgetting, recovery and target-device constraints where relevant.
6. Promote only when the candidate beats a same-corpus/same-budget baseline under a declared threshold and does not break invariants. Reject or defer candidates with measured downsides; record why so later chats do not re-run the same dead end.
7. Study integration effects, not only components: memory ↔ learning, language ↔ evidence, planning ↔ action verification, identity continuity ↔ revision, embodiment ↔ timing, and runtime ↔ persistence/recovery.

Research intake is not limited to a predefined list of repositories or architectures. It may include relevant work on recurrent/state-space models, linear attention, fast weights, test-time training, associative memory, retrieval/reranking, continual learning, uncertainty/calibration, causal inference, active perception, planning, multi-agent interaction, event sourcing, durable agents, speech/viseme synchronization and mobile inference. These are search directions, not a mandate to implement every idea. Incompatible mechanisms may coexist as isolated candidates until a fair tournament decides which survives.

Maintain a source-intake ledger with these fields: candidate; upstream URL/revision; license; subsystem; proposed mechanism; expected benefit; known downside; adaptation boundary; test/ablation; result; resource cost; decision (integrate / adapt / research-only / reject); rationale. Keep the ledger linked from the current handover. Never let research volume substitute for functional integration.

## 3. Required start-of-chat protocol

At the start of every new work session, do not ask the user to restate the mission. Instead:

1. Read this file, `AGENTS.md`, current `README.md`, the latest WorkPass handover/evidence ledger, and the most recent relevant changelog entries.
2. Query GitHub for the current branch head and recent commits; do not assume the SHA written in an old handover is still current.
3. Check the latest Actions runs for the active branch and inspect failed job steps/logs before making claims about CI.
4. Read the unfinished-work list and audit its status against actual code, tests, workflow wiring and commits. Mark an item complete only with a verifiable artifact/test/run.
5. Pick the highest-impact, smallest testable unresolved defect; inspect its canonical owner and existing tests before editing.
6. Implement the fix and regression, run focused tests/typecheck and the cross-cutting workflow where possible.
7. Update this repository's handover/ledger with exact commits, tests, outcomes, limitations, rollback notes and the next 3–10 concrete tasks.
8. End a work session with a clean handover so another chat can continue without redoing discovery.

## 4. Canonical navigation and ownership

- `runtime/neuro-kurisu/`: primary organism/runtime implementation.
- `runtime/neuro-kurisu/src/server/server.mjs`: HTTP/server integration and language invocation path.
- `runtime/neuro-kurisu/src/server/local-language-backend-policy.mjs`: canonical local-language backend selection/circuit-breaker policy.
- `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts`: canonical writable memory store and primary retrieval owner.
- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts` and `MemoryRetrievalExperiment.ts`: offline retrieval evaluation; they must not silently mutate/promote live memory policy.
- `runtime/neuro-kurisu/src/organism/system/OutcomeVerificationService.ts` (verify exact path against current tree before use): source of normalized independent postcondition evidence; caller booleans and tool ACKs are not proof.
- `runtime/neuro-kurisu/tests/`: regression and acceptance tests; ensure important tests are actually invoked by CI/package scripts.
- `app/`: client/UI shell; it must not grow a second canonical organism or memory owner.
- `research/`: isolated candidates; `legacy/`: preserved source/provenance; neither is automatically production-ready.
- `docs/WORKPASS75_REBUILD_AND_EVIDENCE_LEDGER_2026-10-19.md`: reconstruction strategy and scientific acceptance gates.
- `docs/RESEARCH_INTAKE_LEDGER.md`: upstream papers/repos, adaptation boundaries, evidence status and the next research tournament.
- `docs/LOCAL_LLM_SMOKE_GUIDE.md`: safe opt-in live `llama.cpp` smoke procedure for the Dell G3.
- `docs/WORKPASS78_HANDOVER_2026-10-20.md`: latest continuation snapshot with recent commits, CI evidence and prioritized unresolved work.
- `docs/WORKPASS76_REPO_SURFACE_AUDIT_2026-10-19.md`: latest repository surface inventory and unfinished work.

## 5. Acceptance gates — never collapse into one score

- **G0 Reproducible build:** clean install, typecheck, application build, runtime regressions, stable CI.
- **G1 Persistent life:** state survives process death; schema migration, backup/restore, malformed/corrupt state and interrupted writes are tested.
- **G2 Grounded memory:** labelled independent holdout; same-corpus baseline; recall/MRR, stale-fact use, conflict resolution, interference, selective forgetting, provenance and confidence intervals. Do not promote if uplift is zero or leakage is present.
- **G3 Learning:** verified outcomes change behavior; unseen tasks show transfer; no-learning and interference controls quantify forgetting; spoofed/late/duplicate evidence is rejected.
- **G4 Agency:** bounded goals/actions, policy/permission checks, cost/risk budgets, cancellation, external postcondition proof, ACK-loss handling and restart-safe reconciliation.
- **G5 Embodiment:** production browser/mobile E2E for voice, interruption, visibility changes, model assets and actual audio timing.
- **G6 Reliability/performance:** 24–72 h soak, repeated restart/recovery, memory/CPU/latency/error and thermal traces on declared hardware.
- **G7 Identity continuity:** longitudinal held-out behavior, stable preferences, explicit revision of beliefs, autobiographical recall and counterfactual controls.
- **G8 Consciousness:** UNKNOWN / UNRESOLVED absent independent scientific criteria and evidence.

## 6. Open work known at the WorkPass76 start

Treat this as a live queue. Verify branch head and Actions first; do not assume a status is current merely because it appears in this document.

### Recently closed / partially closed (verify exact CI head before relying on it)

- **IMPLEMENTED:** fixed the `invokeLanguage()` timestamp temporal-dead-zone defect; added a regression for timestamp order and actual-response backend attribution. The regression is in the active CI workflow.
- **PROVEN (CI on commit 57215aeda3):** WorkPass76 language-order regression, runtime typecheck and preceding core suite passed in run [39319636214](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39319636214). This is not a live HTTP request or real-model inference.
- **PROVEN (CI on commit 23f9b534):** cold-memory residency regression passed in run [39319686397](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39319686397).
- **PROVEN (CI on commit 268c127):** cold-memory regression wired into the core workflow and that run passed: [39319849208](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39319849208).
- **IMPLEMENTED:** added current-mode / historical-mode revision and bounded revision-history regressions to the core workflow in commit `b8f144348bb756639c02234f5eb2fd3869607b22`.
- **PROVEN (CI):** `tools/audit-runtime-test-coverage.mjs` passed in [run 39320207064](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320207064): 1,200 runnable test-shaped files, 1,124 directly referenced, 76 unreferenced candidates, 1,647 package scripts, 1,308 explicit references, zero missing paths. The 76 remain review candidates, not confirmed dead tests.
- **UNRESOLVED:** full live server/provider request, local model quality, independent memory uplift, learning transfer and consciousness remain unproven.

### Prioritized open queue

1. Confirm the latest workflow on the current branch head, including the end-to-end fake-provider HTTP test and coverage audit.
2. **IMPLEMENTED, CI PENDING:** `runtime/neuro-kurisu/tests/server-language-http-fake-provider.mjs` starts a real server and local fake provider, then checks actual chat HTTP response, backend attribution, latency and provider request identity. Record its final CI result before treating this path as proven.
3. Add an opt-in live `llama.cpp` smoke test with timeout/cancellation, bounded output and cold/warm latency; execute on Dell G3 when accessible.
4. Run independent RU/EN retrieval holdouts, same-corpus baseline, insertion-order/shuffle controls, leakage checks and uncertainty intervals. Previous `recallDelta=0` blocks uplift claims.
5. Run learning-transfer / anti-forgetting ablations and test fact revision, selective forgetting, interference and evidence provenance.
6. Trace one action end-to-end: accepted action → ACK loss/timeout → process restart → read-after-write → independent postcondition → verified learning credit, with duplicate replay.
7. Complete import/reference graphs for runtime source, tests, scripts, package manifests, assets and licenses; treat unreferenced candidates as review items, not deletion instructions.
8. Run production app build, browser/Live2D/TTS E2E, interruption races and actual audio timing.
9. Run 24–72 h soak and target-hardware measurements; current CI does not prove Dell/mobile performance.
10. Review dependency/license/security posture and ensure generated artifacts are not mistaken for canonical source.

## 7. Work-pass definition of done

A pass is complete only when it records:
- exact defect/hypothesis and why it matters;
- files changed and the canonical owner;
- tests added, including which old behavior they reject;
- focused test/typecheck/CI run links and final status;
- observed behavioral result (or explicit absence of measurement);
- unverified scope and environmental blockers;
- rollback/recovery approach;
- updated remaining-work queue.

**Never write “all tasks complete” while any acceptance gate is open.** Maximize real progress, not the appearance of completion.


## Strategic architecture and long-horizon execution (added 2026-10-20)

Read these living documents in this order after this charter:
1. [Master strategy, architecture interaction map, human-brain analogy, weaknesses, provisional scorecard and release gates](docs/NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md).
2. [1,000-work-unit backlog](docs/NEUROCORE_1000_WORK_UNIT_BACKLOG.md). These are planned work units, not completed changes; choose by dependency/risk and split further when needed.
3. [Research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).
4. [Latest handover](docs/WORKPASS78_HANDOVER_2026-10-20.md), refreshed by each work pass.
5. [Repository surface audit](docs/WORKPASS76_REPO_SURFACE_AUDIT_2026-10-19.md).

### Expanded work mandate

Keep the goal broad and the implementation disciplined. Explore widely across ML, cognitive science, neuroscience, continual learning, memory, causal inference, planning, distributed systems, reliability, human-computer interaction, speech, security and systems engineering. Preserve space for novel hypotheses and incompatible prototypes, but isolate them from production until the evidence gate passes. Do not let a research list become an excuse to postpone integration.

At every session, first inspect the live branch head, current Actions runs, unfinished-work register and canonical source paths. Continue from the highest-impact unresolved item without asking the user to repeat the mission. Make code/test changes when possible; update docs as an audit trail, not as a substitute for implementation. Maintain one owner per mutable capability, require a regression for behavior changes, record negative results, and never claim a feature is release-ready from code presence alone.

The master strategy's scorecard is explicitly a triage estimate, not a benchmark. The 1,000-unit backlog is a planning decomposition, not permission to generate 1,000 modules or tickets without value. The complete live file list, call graph, dynamic test-runner graph, dependency/SBOM, license inventory and asset provenance still must be generated from the actual branch before claiming repository-wide exhaustiveness.

### User's continuation phrase

When the user says “работай над проектом”, “продолжай NeuroCore”, “@GitHub продолжай”, or equivalent: resume the existing NeuroCore mission from live GitHub state, check latest CI, inspect the current handover and backlog, select the next real blocker, implement and test it, commit the work, and update the handover/scorecard/source ledger. Never ask them to re-explain the long-term goal.


**Newest continuation handover:** [WorkPass78 — 2026-10-20](docs/WORKPASS78_HANDOVER_2026-10-20.md). Always check the live branch and Actions before relying on its snapshot.
