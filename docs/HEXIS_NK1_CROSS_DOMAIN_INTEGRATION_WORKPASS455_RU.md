# WorkPass455 — Hexis principles mapped to NK1's unified organism

**Date:** 2026-10-23  
**Owner branch:** `planning/master-audit-roadmap`  
**Scope:** architecture mapping and next-pass contracts, not a claim that independent branch commits are already integrated into `integration`.

## Source inspection and decision

Primary source inspected: [QuixiAI/Hexis](https://github.com/QuixiAI/Hexis), whose repository declares MIT licensing, including:
- [Memory Architecture](https://github.com/QuixiAI/Hexis/blob/main/docs/concepts/memory-architecture.md)
- [Identity and Worldview](https://github.com/QuixiAI/Hexis/blob/main/docs/concepts/identity-and-worldview.md)
- [Heartbeat System](https://github.com/QuixiAI/Hexis/blob/main/docs/concepts/heartbeat-system.md)
- [Self-Development](https://github.com/QuixiAI/Hexis/blob/main/docs/concepts/self-development.md)
- [Database Is the Brain](https://github.com/QuixiAI/Hexis/blob/main/docs/concepts/database-is-the-brain.md)

The useful contribution is architectural: stratified memory with provenance and contradiction history; a persistent identity contract distinguished from adaptable worldview; a periodic observe/orient/decide/act/record loop with constrained resources; and subconscious maintenance that proposes observations while deliberation chooses actions. These are mechanisms NK1 can map onto its existing TypeScript runtime.

**Do not clone the Hexis application stack into NK1.** Its PostgreSQL-first/Python worker design is different from NK1's existing canonical runtime, MemoryOS2, ActionGateway, P23 lifecycle, and unified avatar-intent contract. We adapted principles without copying upstream source files and without adding dependencies. The MIT license and source link are recorded for provenance, but each future code port still needs its own file-level review.

## Work integrated on category branches in this execution

| WorkPass | Existing owner branch | Actual code target | Contract strengthened |
|---|---|---|---|
| 449 | `feature/memory` | `P65EpistemicLedger.ts` | Evidence ID idempotence, source-aware support/contradiction revisions, bounded revision history, safe restore |
| 450 | `feature/personality` | `CanonicalSelfAgencyAuthority.ts` | Restore cannot overwrite compiled identity invariants; corrupt/accessor-backed state locks self-agency |
| 451 | `feature/perception` | `RealityEvidenceLedger.ts` | Stable evidence identity, idempotent replay, external-vs-simulator separation, validated restore |
| 452 | `feature/emotions` | `EmotionAppraisalEngine.ts` | Outcome calibration bound to emotion plus homeostatic-pressure context; no context leakage |
| 453 | `feature/visual-embodiment` | `embodimentTimeline.ts`, `AvatarStage.tsx` | Monotonic smoothing for expression/gaze/pose/voice in the existing unified intent; audio-accurate visemes preserved |
| 454 | `feature/feedback` | `ExternalPostconditionVerifier.ts` | Built-in action proof floors cannot be lowered by a later registration |
| 455 | this planning branch | this cross-domain contract | Explicit wiring order and next-pass ownership, without branch merging |

Each owning branch contains corresponding regression-source changes and a category CHANGELOG entry. These changes are committed but the relevant exact-head runtime/typecheck suites have **not** been confirmed passing. The most recent CI evidence continues to show runner-startup failures with no executed steps; this remains a verification blocker, not proof that the changes passed or failed their assertions.

## Keep one brain: event and evidence ownership

The next integration should not create a second memory, emotion, planner, or outcome store. Maintain one canonical flow:

`Sensor/Chat input → normalized observation ID → RealityEvidenceLedger → P65 epistemic claim → MemoryOS2 retrieval/consolidation → homeostatic/emotional appraisals → canonical self/user/world context → planner → EthicalGate → ActionGateway → independent postcondition verifier → outcome receipt → reflection/P23 candidate → holdout and approval → durable memory/self/affect update → EmbodimentIntentV1`.

At every edge, preserve the same applicable event/decision/execution ID, timestamp, source/reality class, uncertainty, and proof lineage. One receipt replayed into three consumers is still one underlying observation, not three independent sources. The LLM's explanation or a tool ACK is not an external effect proof.

## Concrete passes queued next

1. **WorkPass456 — shared evidence-event identity.** Reuse the same verified event ID from ActionGateway/postcondition into RealityEvidenceLedger, P65 and reward/reflection. Deduplicate replay without discarding valid distinct evidence; test same-ID replay and conflicting-payload collision.
2. **WorkPass457 — state-to-decision signal contract.** Define one bounded read-only cognitive context containing energy, load, prediction error, affect, uncertainty, identity integrity and memory freshness. Make the canonical planner the only decision authority; affect/drives rank choices but never bypass Ethics/Gateway.
3. **WorkPass458 — retrieval affects behavior.** Use a fixed bilingual task corpus to test that exact episodic recall/contradiction provenance changes answers or plans in expected scenarios. Compare baseline and candidate on held-out tasks, query coverage, grounded accuracy, latency and budget.
4. **WorkPass459 — close the self-repair loop.** Route typed observed failure → cause diagnosis → repair plan → staged candidate → isolated paired evaluation → per-axis holdout checks → explicit approval/rollback → receipt-backed consolidation. Candidate creation must not authorize activation.
5. **WorkPass460 — converge and package.** Restore actual CI step execution, reconcile category PR heads into `integration` in small reviewable units, run the joined exact-head suite, then rebuild/inspect/hash the Release ZIP. Until a binary asset is replaced and verified, release status stays unchanged.

## Branch exit goals remain category-specific

Use the existing owner branches rather than creating a branch for each pass:
- `feature/memory`: held-out retrieval quality, source/contradiction lineage, bounded consolidation, correction/forgetting and restart safety.
- `feature/perception`: the same normalized observation flows through cognitive trace and cannot mutate state or trigger actions when invalid/stale.
- `feature/emotions`: affect calibration measurably improves regulation/attention without destabilizing agency; context-matched outcomes only.
- `feature/personality`: identity and adaptive traits survive restart/provider changes, corrupt state blocks safely, and changes remain evidence-backed/reversible.
- `feature/visual-embodiment`: the single intent stays synchronized with audio, expression and body state; interruption/retry has no duplicate speech/action.
- `feature/feedback`: stale, spoofed, receipt-only, replayed or unverified effects earn zero independent proof credit.
- `feature/learning`: a real failure-to-repair-to-holdout-to-approval/rollback cycle gives measured, repeatable gains on held-out tasks.
- `feature/useful-functions`: shared snapshot, identity, clock and evidence contracts have one canonical implementation with multiple tested callers.
- `feature/experiments`: exact-head CI and clean-machine validation execute real steps and retain reproducible benchmark outputs.

## Progress truth

Overall engineering readiness remains **46/100** (prior master-audit baseline). Do not raise it because a file was added. The category branches now have additional implementation and regression coverage, but exact-head suites confirmed passing remain **0/7** on the audited scorecard, PR merges remain **0/7**, and the release ZIP refreshed/hash-verified remains **0/1**. These are distinct delivery indicators, not a composite claim of cognition or consciousness.

This note does not assert subjective consciousness. The target is a persistent, self-directed and self-correcting digital organism whose decisions and learning can be causally traced to verified experience.
