# WorkPass93 — durable checkpoint, evidence ledger and continuation plan

**Date:** 2026-10-20  
**Project:** NeuroCore / нейроядро  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Active engineering branch:** workpass79-cognitive-rebuild  
**Open PR:** https://github.com/ailtron1ss-rgb/NK1/pull/1

> This is a checkpoint, not a claim of overall completion. At the beginning of every session, re-query the live branch HEAD, PR state and latest Actions run. SHA values below are evidence anchors, not permanent claims about the live HEAD.

## 1. Mission and non-negotiable constraints

Build NeuroCore as one integrated, actually functional, memory-rich, adaptive digital organism/personality, with Makise Kurisu as the intended persona direction. The goal is measurable capability and continuity, not an accumulation of named modules.

- Work code-first whenever an actionable defect is available.
- Preserve one canonical owner for memory, provider selection, action execution, evidence and persistent state.
- No placeholders, fake metrics, duplicate state owners, empty stubs or disconnected wrappers.
- Every behavior change needs a regression that detects the old failure mode.
- Research candidates remain hypotheses until licensed, adapted, compared against fair baselines and validated.
- Report PROVEN, IMPLEMENTED, FUNCTIONAL INDICATOR, OBSERVED, HYPOTHESIS, UNKNOWN, UNRESOLVED and FAILED accurately.
- Never claim subjective consciousness from software tests or self-reports.
- Do not merge branches or change PR state without a separately justified action.

## 2. Latest confirmed repository evidence

### WorkPass93 — exact core-ownership exemption

- Added runtime/neuro-kurisu/scripts/core-ownership-policy.mjs.
- Changed runtime/neuro-kurisu/scripts/audit-core-ownership.mjs so the sole allowed direct-constructor exemption is the exact pair:
  - field: operationalMicroCycle
  - constructor: OperationalMicroCycleRuntime
- The audit now includes an executable regression guard with adversarial cases: exact allowed pair is exempt; same field with a different constructor is counted; same constructor under a different field is counted; unrelated owner is counted.
- Final audit output lists all direct owners and the owners counted toward the ceiling.
- This removes a field-name-only bypass and keeps the existing constructor ceiling intact.

Code evidence anchors:
- Policy module creation: 8bcffba1511e1327ae71f7500295d31ccffa3c73
- Audit integration: ce804abde19ccd20868cd579032431550ca1c35a
- Prior baseline audit: 04f16761704760a6c347a77e113a7a9221b661fe

**Validation status:** IMPLEMENTED. The new branch-head CI result was not yet confirmed when this checkpoint was authored. Do not mark the pass fully validated until the exact new HEAD's workflow run passes. The embedded policy regression runs as part of audit:core-ownership, already wired into the cognitive runtime regression workflow.

### Previous evidence retained, not overstated

- WorkPass92 core ownership audit passed at [Actions run 39380982918](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39380982918), on code head 04f16761704760a6c347a77e113a7a9221b661fe. This is a pre-WorkPass93 baseline, not validation of the new commits.
- WorkPass91 memory-to-action sandbox regression passed at [Actions run 39380460196](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39380460196), test commit 12ed8ee0029c9c62d5abaef1141d403d68fcc34e. It covers revised preferences, superseded-memory suppression, snapshot/restore, clarification when evidence is missing, grounded arguments and durable action idempotency in an in-memory sandbox. It does not prove that the live planner independently performs this reasoning or that external side effects are safe.
- WorkPass88 benchmark-label integrity passed at [Actions run 39378246137](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39378246137). Synthetic fixture results validate measurement plumbing only; they do not demonstrate independent retrieval uplift.
- The open PR remains draft and unmerged according to the latest PR search. Recheck live state each session.

## 3. Current progress dashboard

Percentages measure engineering workstream/evidence closure, not consciousness or intelligence and not an aggregate inferred from file counts.

| Workstream | Status | Progress | Evidence / next gate |
|---|---|---:|---|
| Durable session continuity | IMPLEMENTED | 90% | Keep checkpoint links synchronized with live HEAD and CI |
| Core ownership boundary | IMPLEMENTED | 85% | Exact exemption now has an executable regression guard; exact-head CI pending |
| Local language provider | IMPLEMENTED / PARTLY PROVEN | 60% | Provider boundary, timeout/cancellation and fake-provider HTTP path have prior CI; live llama.cpp on target laptop unproven |
| Memory revision and persistence | IMPLEMENTED / PARTLY PROVEN | 55% | Synthetic cold-memory, supersession and snapshot tests exist; independent RU/EN quality and long-run persistence remain open |
| Memory-to-action grounding | FUNCTIONAL INDICATOR | 35% | Sandboxed integration test exists; live planner mapping and external action recovery unproven |
| Retrieval-quality uplift | UNKNOWN | 15% | Synthetic harness validates measurement plumbing, not uplift; independent labelled holdout needed |
| Continual learning / transfer / anti-forgetting | UNRESOLVED | 10% | No accepted independent transfer/retention evidence recorded here |
| Real browser / voice / TTS / Live2D E2E | UNRESOLVED | 15% | Real integration and interruption/reconnect tests still needed |
| Live model, target-device, soak and release gates | UNRESOLVED | 10% | Dell G3 live-model run, recovery/soak, clean install/rollback, SBOM/licensing and release checks remain open |

**WorkPass93 execution:** 70% at checkpoint creation — code and regression guard implemented; durable report is being written; exact-head CI and documentation synchronization remain. Update only against completed, linked evidence.

**Overall functional completion:** not responsibly reducible to one proven percentage yet. These are explicit triage estimates, not benchmark scores. Green CI is not evidence of human-level intelligence, consciousness, live-device performance or learning transfer.

## 4. Highest-priority unresolved work

### P0 — verify this pass and protect continuity

1. Query live PR head and latest Actions; verify audit runs against the exact new head.
2. Inspect workflow logs for the embedded exemption cases and CORE_OWNERSHIP=PASS; fix any failure without weakening assertions.
3. Ensure README.md, NEUROCORE_START_HERE.md, AGENTS.md, changelog and this handover point to the same active branch/checkpoint.
4. Refresh the PR description so its evidence summary is not stuck at WorkPass88.

### P1 — next code-first runtime work

5. Add restart/fault-injection coverage for in-flight language requests and action receipts: interruption, lost acknowledgement, duplicate delivery, replay and reconciliation.
6. Run the opt-in llama.cpp smoke on the Dell G3 (Intel i5 / GTX 1650). Record model SHA-256, quantization, llama.cpp build, GPU layers, context, cold/warm latency, peak RAM/VRAM, output truncation, cancellation and restart behavior. Do not fabricate device results from CI.
7. Complete the action proof matrix: absent, stale, spoofed, late and contradictory postcondition evidence; no duplicate side effects after restart.
8. Generate exact live inventories: tracked paths, import/call graph, package scripts/workflow/test-runner graph, dependencies/SBOM/licenses, source/asset provenance and content hashes. Keep unreferenced test-shaped candidates as review candidates, not confirmed dead tests.

### P1 — cognitive quality evidence

9. Freeze a versioned, independently labelled RU/EN retrieval holdout with provenance, licence, stable IDs and SHA-256. De-duplicate across splits and block promotion on leakage or silent truncation.
10. Compare MemoryOS2 against same-corpus BM25, no-memory and feasible oracle controls; preserve per-case outputs, per-language/scenario results, paired confidence intervals, latency and memory residency. Measure stale-fact rate, temporal updates and abstention separately.
11. Run sequential learning experiments with positive feedback, wrong feedback, correction/reversal, delayed retention, paraphrase transfer, unrelated-task interference and a no-learning control. A changing memory counter is not proof of learning.
12. Complete production build and real browser/Live2D/TTS interruption/reconnect E2E; then run 24–72 hour soak and packaging/rollback/security gates.

## 5. Research and integration policy

Continue broad, selective research across memory, retrieval, continual learning, state-space/recurrent models, fast weights, test-time training, causal inference, world models, planning, control, uncertainty, speech/embodiment, durable systems and security. Do not integrate a mechanism just because it is novel or popular.

For each candidate, record upstream URL/revision, licence, exact files/functions, resource assumptions, expected benefit, downside, canonical integration owner, experiment, result and decision. Preserve incompatible candidates as isolated experiments. Promote only with a fair same-budget baseline, meaningful ablation, independent holdout and recovery/resource checks.

Existing research gate: [Memory and continual-learning research gate](RESEARCH_GATE_MEMORY_CONTINUAL_LEARNING_2026-10-20.md). Existing master map: [NeuroCore master strategy and brain map](NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md). Existing task matrix: [1,000-work-unit backlog](NEUROCORE_1000_WORK_UNIT_BACKLOG.md).

## 6. New-session resume protocol

When the user says “продолжай”, “@GitHub работай”, or equivalent:

1. Read NEUROCORE_START_HERE.md, AGENTS.md, README.md, this checkpoint and the newest changelog entry.
2. Query live branch head, PR state and newest Actions run. Do not trust an old SHA as current.
3. Inspect failed workflow steps/logs before editing.
4. Continue from the first unresolved P0/P1 item above; do not ask the user to restate the mission.
5. Inspect canonical source owner and existing tests before making a code change.
6. Implement a behavior change plus regression. Run focused tests and typecheck; use CI for cross-cutting validation.
7. Update this report or create a numbered successor checkpoint with commit SHAs, exact tests/run links, status labels, limitations, rollback note and next 3–10 tasks.
8. Keep the PR draft/unmerged unless a separately justified release review authorizes a change.

## 7. Explicitly unproven

- Actual llama.cpp inference, quality and resource profile on the Dell G3 through the real app/runtime path.
- Independent labelled RU/EN retrieval improvement.
- Transfer learning, delayed retention and anti-forgetting.
- End-to-end live planner memory-to-action grounding.
- Restart-safe external action execution and independent postcondition verification.
- Real browser, voice/TTS and Live2D end-to-end behavior.
- Target-device performance, soak stability, clean installation, rollback and release readiness.
- Subjective consciousness or inner experience.

These remain UNKNOWN / UNRESOLVED until separate evidence closes each gate.
