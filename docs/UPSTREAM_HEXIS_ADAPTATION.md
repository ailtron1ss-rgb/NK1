# Hexis → NK1: integrated adaptation map

**Reviewed:** 2026-10-24  
**Target:** one canonical NK1 organism; no second Hexis agent or duplicate memory owner.  
**Status:** selected mechanisms adapted in category branches; exact-head checks and cross-branch integration remain open.

## Sources and what to take from each

### 1. QuixiAI/Hexis — evidence-aware memory and autonomous state

Upstream: https://github.com/QuixiAI/Hexis

Selected mechanisms:
- multi-timescale / typed memory, source provenance, and temporal context;
- belief revision from independent supporting or contradicting evidence;
- immutable revision audit and explicit handling of conflicting sources;
- bounded memory maintenance, reversible archival, and review before learning changes;
- heartbeat decisions recorded as episodes, with resource budgets and receipts.

NK1 adaptation:
- `feature/memory`: `MemoryOS2` remains the canonical general-purpose memory owner and already maintains bounded source-lineage evidence, confidence revision history, temporal validity, conflict links, protected records, and budget-aware retrieval.
- `feature/memory`: `P65EpistemicLedger` provides a distinct epistemic projection for claims, predictions, and belief revision; it now accepts an optional stable `independenceKey` so publisher aliases / syndicated copies cannot be counted as multiple independent witnesses. Evidence IDs are bound to the lineage key; normalized lineage metadata is persisted with backward-compatible v2 restore.
- These two structures have different responsibilities: MemoryOS2 is the canonical memory store; P65 is not a second store for the same memory corpus. The integration goal is to route the same authenticated evidence identity through both, not to create a separate PostgreSQL brain.

Upstream reference: https://github.com/QuixiAI/Hexis/blob/main/docs/concepts/memory-architecture.md  
Belief revision: https://github.com/QuixiAI/Hexis/blob/main/db/59_belief_revision.sql  
Heartbeat: https://github.com/QuixiAI/Hexis/blob/main/docs/concepts/heartbeat-system.md

### 2. hexis-framework/hexis — learn from verified corrections

Upstream: https://github.com/hexis-framework/hexis  
Adaptation boundary: general correction lifecycle only; Claude Code-specific hooks and CLI are not transplanted.

NK1 adaptation in `feature/learning`:
- `CorrectionRuleMemory` accepts only structured, reviewed correction observations, with an applied correction, reviewer identity, evidence fingerprint, and affirmative host verifier.
- Maturity flows from soft rule → reinforced rule → gate-review candidate. Ambiguous rules and instruction conflicts recommend rewriting rather than brittle enforcement.
- Gate candidates never activate policy gates themselves; promotion remains under the existing P23/independent approval path.
- The P23 facade exposes these assessments as Pareto-ranked repair/evidence learning targets, keeping them within the main curriculum instead of adding a parallel learner.
- Replay hardening: one review-evidence fingerprint cannot be reused under a new observation ID to inflate recurrence. Restore preserves only the first verified artifact for that rule and quarantines later rows that reuse it.

Upstream reference: https://github.com/hexis-framework/hexis/blob/main/docs/enforcement-escalation.md

### 3. Bevel-Software/Hexis — skill permissions and lifecycle

Upstream: https://github.com/Bevel-Software/Hexis

Keep as a source for versioned skill proposals, narrow permissions, review-gated activation, audit logs, and rollback. Its full runtime has **not** been vendored; NK1's P23 versioned candidate store and authenticated promotion path remain authoritative. Before any code port, re-check the current upstream license, exact commit, dependencies, and attribution requirements.

## Cross-system contract

The intended single learning/memory cycle is:

1. Runtime observation / action receipt.
2. Stable evidence identity: source + independent lineage + evidence ID + timestamp.
3. Canonical memory ingest with provenance and temporal validity.
4. P65 epistemic projection: observation / inference / belief / prediction; record support, contradiction, and uncertainty without silently replacing history.
5. Verified outcome and failure diagnosis flow to P23.
6. Correction/skill candidate is staged with source trace and exact payload fingerprint.
7. Independent validation + holdout + regression-family gate.
8. Approval-controlled promotion; activation receipt and reversible rollback.
9. Real measured outcome feeds the next memory and learning cycle.

A self-report, copied payload, same-source mirror, repeated review fingerprint, tool ACK, or model-generated “success” must not create a second independent vote or directly activate a rule/skill.

## Status of concrete changes

| Area | Code-level status | Evidence boundary |
|---|---|---|
| MemoryOS2 source-aware evidence and confidence revisions | Existing mechanism in `feature/memory` | Retrieval/learning uplift not established |
| P65 independent evidence revision + stable lineage key | Added in `feature/memory`, WorkPass477 | Regression source expanded; exact-head execution pending |
| Hexis-style reviewed correction memory | Existing in `feature/learning` via P23 | Host verifier wiring and exact-head runtime validation remain release gates |
| Reused correction-artifact rejection and restore quarantine | Added in `feature/learning`, WorkPass477 | Regression source expanded; exact-head execution pending |
| Unified end-to-end same-receipt identity across MemoryOS2 → P65 → P23 | **Open** | Needs runtime call-graph wiring, end-to-end deduplication test, and persisted restart test |
| Hexis heartbeat semantics integrated with NK1 initiative scheduler | **Partial / open** | Must use existing cognition and ActionGateway; no second scheduler |
| Bevel skill permissions/review design | Research candidate | No upstream runtime copied |

The category PRs for memory and learning currently target `integration` and remain draft/unmerged. Code on a category branch is not yet proof of a released end-to-end feature.

## Next code-first passes

1. **H4 — evidence identity bridge:** pass the same canonical receipt/event identity through MemoryOS2, P65, and VerifiedOutcomeLedger; prove retries and mirrored deliveries are idempotent across restart.
2. **H5 — initiative bridge:** reuse the NK1 cognitive cycle / runtime scheduler and ActionGateway; bind each autonomous decision to goal, resource budget, permission check, action receipt, and episodic consolidation.
3. **H6 — skill governance:** compare P23 versioned skill promotion with Bevel's permission and approval model, port only missing enforceable semantics, and test rollback.
4. **H7 — measured integration:** run independent RU/EN memory-to-action and skill revision holdouts with paired seeds, negative-transfer controls, and a predeclared promotion threshold.
5. **H8 — release readiness:** full exact-head Actions/typecheck, real model and embodiment E2E, restart recovery, security/privacy, soak, reproducible release asset and rollback proof.

No new runtime dependency is required for the adaptations described above. Do not add one merely to copy Hexis's database stack. Any later dependency must be justified by a demonstrated capability gap and pinned/recorded in the branch that adopts it.


### WorkPass479 — shared event identity and RealityEvidenceLedger

- `feature/feedback` now has a shared domain-separated `createStableEvidenceEventId` helper. The existing `OutcomeVerificationService` keeps the same `outcome:<40-hex>` identity format, while `EmbodiedActionExecutor` attaches a separate `embodied:<40-hex>` idempotency key to normalized action results.
- `RealityEvidenceLedger` deduplicates identical event replays, quarantines conflicting reuse, excludes quarantined events from promotion/counts, and validates bounded persisted records. `OrganismRuntime` attaches distinct action/consequence suffixes to the same embodied event ID.
- This closes only the embodied-result → RealityEvidenceLedger segment. The verifier-issued outcome event ID still needs full call-site propagation across canonical MemoryOS2, P65, and P23; the event ID itself is never authority.
