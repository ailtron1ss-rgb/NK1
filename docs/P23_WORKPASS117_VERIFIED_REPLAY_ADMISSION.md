# WorkPass117 — verified evidence-gated replay admission

Date: 2026-10-21  
Base: `workpass116-seed-clustered-learning-eval`  
Branch: `workpass117-verified-replay-admission`

## Concrete implementation

Added `src/organism/learning/VerifiedReplayAdmission.ts`, an adapter from the canonical `VerifiedOutcomeLedger` to the existing `ReplaySelectionPolicy`. It does not create a second replay store or a parallel selection algorithm.

An experience is admitted only if the ledger already contains an accepted outcome matching the exact tuple `taskId + method + seed + attempt`, and the experience also matches the task version and evidence reference. Task split is checked against the versioned manifest; the default is `train`, so validation/holdout outcomes cannot silently leak into replay. Caller must explicitly select another split.

Both verified successes and verified failures are retained: failures are useful for recovery and repair, but are never mislabeled as successes. The adapter returns manifest fingerprint and outcome provenance alongside each selected experience, plus explicit rejection codes for invalid references, unknown tasks, wrong split, version drift, absent outcomes, mismatched evidence, and duplicate experience IDs. Self-reports cannot enter through this adapter because the ledger rejects them as authoritative outcomes.

The adapter then delegates batch sizing, recency, diversity and surprise ranking to the existing selector. This avoids duplicating replay-selection logic and keeps the current production default unchanged.

## New regression fixture

Added `tests/p23-verified-replay-admission.mjs` and wired it into the continual-learning GitHub Actions workflow. The fixture covers:
- exact evidence match and task-version matching;
- default training-only admission and explicit holdout opt-in;
- rejection of unknown tasks, missing outcomes, wrong evidence, stale task versions and duplicate experience IDs;
- preserving independently verified failures for repair learning;
- preventing self-reported success from becoming authoritative replay evidence;
- preservation of the ledger manifest fingerprint in admitted records.

The new test has been added to CI but has **not yet been executed successfully in this pass**. Prior Actions runs for this workflow failed before executing any steps (runner ID 0 / no retrievable log); that infrastructure issue remains unresolved. Do not mark this pass as validated until an exact-head run actually executes.

## Research intake and adaptation decisions

- **SkillLearnBench** — https://github.com/cxcscmu/SkillLearnBench (MIT). Its three distinct levels—skill quality, execution trajectory, and verified task outcome—support keeping outcome provenance separate from the skill/experience artifact. Do not import its Docker/API-heavy benchmark harness into the lightweight runtime; adapt the protocol first.
- **AgentMemoryBench** — https://github.com/solomoon313/AgentMemoryBench. Its online, replay, transfer and repair modes motivate measuring failure-repair as well as pass-rate retention. Import no task dataset or dependency here.
- **XSkill** — https://github.com/XSkill-Agent/XSkill (MIT). Its separation of task-level skills and action-level experiences is a useful architectural comparator. NK1's current change establishes a verified evidence bridge for experiences; it does not yet distill skills from trajectories or prove cross-task transfer.
- **ContinualSkillBench** — https://arxiv.org/abs/2608.03874. Its domain/order-dependent findings motivate context-only and explicit-skill controls and per-family reporting instead of assuming that stored skills always help.
- **Learning to Replay (L2R)** — https://www.sciencedirect.com/science/article/pii/S0031320326017097. The published design jointly learns replay content and replay timing. NK1 should first collect trustworthy learner-state, buffer, outcome and cost signals; this pass intentionally does not imitate a meta-controller without those signals.

No upstream code or datasets were copied in this pass. The useful contribution is the narrow integration contract; reuse of external source code still requires a pinned revision and license/dependency review.

## Status, scores and next work

Scores remain unchanged because no real learner run or verified performance uplift was measured:
- Overall learning engineering: **57/100**
- Evidence-grounded maturity: **36%**
- P23 symbolic continual-learning core: **61%**
- Project-wide lifelong-learning roadmap: **30%**

Implementation coverage improved by one explicit bridge: verified outcomes can now gate replay admission when a caller uses this adapter. Production wiring remains incomplete: the live learner/task runner does not yet automatically supply experience references and invoke this adapter.

### Next concrete steps

1. Wire the adapter at the real experience/replay intake point, preserving an opt-out compatibility path and avoiding any default behavior change until integrated coverage is known.
2. Make evidence artifact retrieval and verifier-run identity part of the ingestion boundary, rather than trusting a caller-provided URI alone.
3. Add an explicit skill-candidate lifecycle: draft → verifier-backed candidate → repeated cross-task evaluation → promotion/rollback, with versioned provenance.
4. Run the same versioned task stream and seeds for context-only, no-replay, recency, surprise, diversity, reservoir and multi-timescale arms. Report success, old-task retention, forward transfer, repair after erroneous feedback, latency and memory.
5. Revisit scores only after exact-head CI runs and real verifier-backed paired outcomes.

This pass is an architectural integration improvement, not proof that NK1 has become better at learning.