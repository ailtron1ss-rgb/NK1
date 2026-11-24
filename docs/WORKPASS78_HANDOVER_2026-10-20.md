# WorkPass78 handover — NeuroCore strategic plan and execution backlog

**Date:** 2026-10-20  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Active branch:** `workpass70-source`  
**Branch head at handover creation:** `c9b654a78a2c4e7ab08274531e7b986cf450c212`  
**Purpose:** preserve the user’s strategic request and make the next chat resume from live evidence without re-asking the mission.

> This is a snapshot. Always inspect the live branch head and latest Actions before relying on any SHA or CI status.

## Mission (persistent)

Build NeuroCore / нейроядро as one cohesive, genuinely functional, memory-rich, learning-capable, adaptive digital organism/personality, with Makise Kurisu as the intended identity direction. Historical `Neuro-Kurisu` path names are lineage, not a separate product. Do code-first work; inspect broad scientific/source ideas, adapt only where useful, preserve one canonical owner per capability, test behavior and avoid decorative modules, fake metrics, duplicate stores, blind copying and unsupported consciousness claims.

When the user says “работай над проектом”, “продолжай NeuroCore”, “@GitHub продолжай” or equivalent, continue this mission automatically. Do not ask the user to repeat it.

## New artifacts

1. [Master strategy, brain map, scorecard, risks and release gates](NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md)
2. [1,000-work-unit backlog](NEUROCORE_1000_WORK_UNIT_BACKLOG.md)
3. [Expanded research intake including adjacent cognitive/neuroscience/control literature](RESEARCH_INTAKE_LEDGER.md)
4. Updated [persistent charter](../NEUROCORE_START_HERE.md), [agent rules](../AGENTS.md), and [README](../README.md)
5. Previous WorkPass77 remains linked as a historical handover; this document is the newer continuation point.

## What the strategy includes

- Product invariants and anti-patterns.
- Provisional engineering triage scores, explicitly not benchmark results.
- A 20-domain functional architecture and interaction trace.
- Human-brain functional analogy and limitations; no one-to-one anatomy claims.
- A 20-item risk register, staged path to release, scientific intake directions.
- Known canonical file paths and a precise list of inventories still to generate.
- Twelve prioritized next actions.

## Backlog semantics

The backlog is 20 domains × 10 subareas × 5 lifecycle gates = 1,000 distinct planned work units. Every row begins PLANNED / UNVERIFIED. It is not 1,000 completed changes and not a mandate to generate 1,000 files. Split further along independently testable state transitions, failure modes, contracts and evidence criteria; reject tasks without demonstrated value.

## Current honest quality picture

The master scorecard is a triage estimate based on documented gaps, not a measured aggregate. The most important unresolved release evidence remains:

- Actual `llama.cpp` inference on Dell G3 through the real app/runtime path.
- Independent labelled RU/EN retrieval uplift; prior `recallDelta=0` blocks uplift claims.
- Transfer learning with no-learning, wrong-feedback, reversal, interference and forgetting controls.
- Provider failure/cancellation/cooldown/fallback behavior over the HTTP path.
- Restart during in-flight language requests and actions, with no duplicate side effects.
- Independent postcondition verification, lost ACK, spoofed/late proof and duplicate delivery.
- Dynamic test-runner reachability and review of the 76 unreferenced test-shaped candidates (not confirmed dead tests).
- Exact source/call graph, dependencies/SBOM/licenses, upstream provenance and asset hashes.
- Production browser/Live2D/TTS interruption/reconnect E2E.
- Target-device performance, 24–72h soak, security/privacy review, clean-room packaging and rollback.

**CI boundary:** no new runtime code was added in this pass; changes are documentation/planning. No green CI claim is made for the final documentation head unless the live Actions page confirms it. Prior passing runs cover earlier validated code/workflow, not actual live inference on the laptop.

## Next work pass: execute, do not only plan

1. Refresh live branch SHA and Actions status.
2. Inspect `local-language-backend-policy.mjs`, real server provider path and existing tests; add HTTP-level 503/timeout/malformed-response/cancel/fallback/cooldown/recovery regressions.
3. Add crash/restart injection during language request and action, preserving idempotency and reconciliation.
4. Run live local model smoke on Dell G3 and capture model SHA, quantization, context, GPU layers, server version, cold/warm latency and output limits.
5. Generate path manifest, import/call graph, script/workflow/dynamic test-runner graph, dependency/SBOM/license inventory and asset provenance.
6. Freeze independent RU/EN retrieval holdouts; run same-corpus baseline/candidate, leakage audit, insertion-order/shuffle controls and confidence intervals.
7. Build transfer/reversal/interference/forgetting experiments with no-learning and wrong-feedback controls.
8. Finish action-evidence state matrix and spoof/late/duplicate/restart tests.
9. Complete production build and real browser/Live2D/TTS E2E.
10. Run soak and target-hardware profiling; finish packaging, upgrade, rollback and artifact-integrity gates.

## Rules for future work

- Research widely across ML, cognitive science, neuroscience, memory, continual learning, causal inference, planning, control, distributed systems, HCI, speech, security and systems engineering.
- For every source candidate, record URL, exact revision, license, provenance, relevant files, integration boundary, expected benefit/downside, experiment and reject/promotion decision.
- Never infer a complete source inventory from selected paths. Generate it from the live tree and check dynamic imports, workflow runners, asset hydration and package scripts.
- Every behavior change needs a regression. Keep negative results. Use same-corpus/same-budget comparisons and independent holdouts.
- The actual hardware test context includes Dell G3 (Intel i5, GTX 1650) and mobile target Poco M7 Pro 5G / 8 GB RAM; do not transfer performance claims across devices.
- Consciousness and subjective experience remain UNKNOWN / UNRESOLVED; describe measured capabilities rather than asserting inner experience.

## Resume phrase

If a new chat starts with “работай над проектом”, read `NEUROCORE_START_HERE.md`, `AGENTS.md`, this handover, the master strategy, backlog and research ledger; inspect the live branch and Actions; then continue the highest-impact unfinished implementation task with code/tests and an updated handover.