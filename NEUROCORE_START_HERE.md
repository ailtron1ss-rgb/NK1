# NeuroCore — persistent project charter and resume contract

**Canonical project name:** NeuroCore / нейроядро  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Active work branch:** `workpass70-source`  
**Primary intent:** build one cohesive, genuinely functional, memory-rich, learning-capable, adaptive digital organism/personality, with Makise Kurisu as the intended identity/persona direction. The historic `Neuro-Kurisu` name in directory paths is lineage, not a separate project.  
**This document is the durable instruction for future work. Read it before starting a new pass.**

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
8. **Do not silently merge branches:** continue on `workpass70-source`; inspect branch history and CI before proposing a merge to `main`.
9. **Report exact evidence:** label findings `PROVEN`, `IMPLEMENTED`, `FUNCTIONAL INDICATOR`, `OBSERVED`, `HYPOTHESIS`, `UNKNOWN`, `UNRESOLVED` or `FAILED` accurately.
10. **Skip blockers intelligently:** continue independent work when a device, registry, secret, external service or hardware test is unavailable; record the blocker and exact reproduction steps instead of fabricating results.

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

Treat these as a queue to re-verify, not as guaranteed current facts:

1. Fix and regression-test language invocation/backend attribution; inspect the full provider path and confirm an actual server request succeeds.
2. Correct the previously identified retrieval/residency issue: retrieval must not warm/materialize cold memory merely to calculate a signal that does not affect ranking; add a behavioral test that snapshots residency/maintenance state before and after ordinary retrieval.
3. Add an opt-in live local `llama.cpp` smoke test (default CI must require no secret, internet or model download) with latency, timeout/cancellation, output bounds and actual backend attribution.
4. Add a real autobiographical fact-revision/temporal query suite; old facts must not leak into current answers after revision.
5. Run independent retrieval holdout and learning-transfer/anti-forgetting ablations; prior retrieval work recorded `recallDelta=0`, so do not claim uplift until measured.
6. Trace one action end-to-end: accepted action → ACK loss/timeout → process restart → read-after-write → independent postcondition → verified learning credit, with duplicate replay.
7. Generate and inspect import/reference graphs for runtime sources, tests, scripts, package manifests, assets and licenses; do not delete historical files until references are resolved.
8. Test app production build, browser/Live2D/TTS E2E, interruption races and actual audio timing.
9. Run soak and target-hardware performance tests; current CI is not evidence of 24–72 h stability or Dell/mobile performance.
10. Review dependency/license/security posture and verify generated artifacts are not mistaken for canonical source.

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
