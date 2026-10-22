# WorkPass292 — verified experience lanes and unified brain feedback (2026-10-22)

## Intent

Strengthen the connection between the world/action verifier, causal episodic experience, consolidation/replay, and adaptive learning without introducing a second memory owner or a parallel promotion authority. The key rule is:

> External reports can propose a lesson. They cannot certify their own provenance, ground their own state transition, or award themselves behavioral credit.

This improves evidence quality and makes the learning pathway explainable; it is not evidence of biological consciousness or proof of autonomous behavior by itself.

## Changes landed in NK1

1. **Causal experience stream.** One bounded predicate (isGroundedRuntimeOutcome) now guards unified learning packets, consolidation, replay candidate selection and behavioral-drift summaries. A restored row labelled runtime-outcome is kept in that lane only when it also has stateGrounded === true and a bounded finite 16–64 element policy vector in [0,1]. A caller-supplied provenance label is forced to external by recordExternalLearningEvent.
2. **Unified learning substrate.** Schema v4 adds a bounded queue of 128 external learning hypotheses. ingestExternalSignal now queues claims and returns acceptedAs: 'unverified-hypothesis' / coreLearningUpdated: false; it does not update the trusted pattern bank, shared representation, trusted sample count, or transfer estimates. A trace outcome can affect a pattern only when the grounded record matches the exact trace ID, tick and selected action.
3. **Legacy-state migration.** Schema v3 learned representations, patterns and source counters have no per-sample lineage and may include self-reported replay/repair claims. They are reset when migrating the learning substrate to v4. Organism identity, durable memory and world state remain outside this reset. This intentionally favors trustworthy future learning over retaining untraceable weights.
4. **Runtime and architecture wiring.** OrganismCore.unifiedLearningExternalHypotheses(limit) exposes a read-only copy of the oldest pending claims to an independent assessor. The architecture map documents the separate external-hypothesis path; the canonical writable-memory owner and existing outcome authorities remain unchanged.
5. **Independence is not the same as externality.** The causal development loop and macro-synthesis now use the existing external evidence independence counter (at least two independent sources) for the independent signal instead of treating any projectEvidenceExternal flag as independent evidence. External origin, outcome verification, and independent corroboration are separate properties.
6. **Regression surface.** Added tests/workpass292-evidence-lanes.mjs, package script test:workpass292:evidence-lanes, and a Node 24 GitHub Actions workflow. The test covers spoofed provenance/grounding, trusted-only packet aggregation, replay/consolidation eligibility, learning-lane isolation, restore downgrading, legacy-schema reset and the runtime independence gate.

## Architecture: one recurrent loop, separate evidence lanes

~~~text
Perception / user / device / external research
                 |
                 v
     claim + source provenance envelope
                 |
                 v
      bounded ExternalLearningHypotheses
                 |
          independent assessor
          (not auto-wired yet)
                 |
                 v
canonical verifier + independent source evidence
                 |
                 v
CausalExperienceStream (trace + tick + state transition)
                 |
        +--------+---------+
        |                  |
        v                  v
UnifiedLearningSubstrate  canonical memory lifecycle
(shared representation,  (MemoryOS2 / existing owner)
verified patterns)        |
        |                  v
        |           consolidation / replay admission
        +-------+----------+
                v
      P23 candidate generation/evaluation
                |
        validation + holdout
                |
       existing promotion approval
                |
          checkpoint/rollback
~~~

The external queue is intentionally **not** a new writable memory system and is not yet automatically consumed by P23. It is an explicit, read-only handoff point for a later independent-assessment adapter.

## Research mechanisms adapted

- **Hermes Agent Self-Evolution** — adapt trace/failure-driven revisions, bounded candidate payloads, controlled evaluation, holdout/regression checks, and human-reviewed deployment. NK1 does not add a second skill runtime or copy its promotion authority: https://github.com/NousResearch/hermes-agent-self-evolution
- **Letta memory/dreaming** — keep durable memory changes separate from candidate consolidation; assess, revise, and checkpoint before reorganizing long-lived memory: https://docs.letta.com/
- **Generative Agents** — maintain a recurrent relation between memory, retrieval/reflection, planning, and action rather than treating each component as an isolated utility: https://arxiv.org/abs/2304.03442

No new package dependency was needed in this pass. The selected patterns were adapted to NK1's current authorities, rather than imported wholesale.

## Explicit limits / next passes

- The GitHub Actions run is **marked failed**. The connector exposes no step summaries and the job-log endpoint returned no log archive, so I cannot establish whether the test command ran or what failed. No pass is claimed; diagnosis remains open.
- The independent-hypothesis queue has a read-only runtime accessor, but no assessor consumes it yet. Do not auto-promote any queued claim.
- The causal-development and macro-synthesis independence flags now use the existing two-source counter; other legacy subsystems still accept a range of evidence fields and deserve staged authority/lineage review rather than a broad, risky search-and-replace.
- A full initiative → action ticket → canonical outcome → causal experience → MemoryOS2 consolidation → replay admission → P23 candidate/holdout → approval/rollback path must be exercised end-to-end before calling the organism autonomous.

## Next branch goals

| Workstream | Concrete target | Definition of done |
|---|---|---|
| WP293-A: independent assessment | Consume queued hypotheses using existing trusted evaluation services; bind each result to a stable hypothesis digest and candidate/task manifest | no untrusted claim directly updates patterns; verified, rejected, stale and inconclusive outcomes are separately recorded |
| WP293-B: causal runtime join | Correlate exact action ticket, trace ID, tick, postcondition receipt and independent-source count | missing/stale/mismatched receipt yields unknown; no reward/verification credit; valid same-action receipt reaches the single canonical learner |
| WP293-C: consolidation | Feed only grounded causal records into the canonical memory lifecycle and sleep consolidation | one writable MemoryOS2 owner; bounded diverse selection; provenance/temporal links retained |
| WP293-D: P23 skill evolution | Build bounded candidate revisions from attributable failures; preserve baseline, candidate, holdout, provenance, approvals and rollback | regressions block promotion; creator cannot self-approve; repeated failure triggers repair plan rather than unbounded retries |
| WP293-E: autonomy continuity | Connect endogenous goals and homeostatic drives to a budgeted action scheduler and temporal continuity | self-initiated actions have a named reason, unique action ticket and observable result; the one-action-per-hour target is measured rather than presumed |
| WP293-F: embodied identity | Verify the existing affect → avatar/voice controller path without adding duplicate state owners | facial/voice output reflects the same persisted internal state, with safe fallback and tests |
| WP293-G: operational readiness | Execute focused regressions and Node 24 workflow; then a clean-machine install/Compose check | machine-readable evidence for runtime tests, typecheck, startup and the documented acceptance gates |

## Progress ledger

- WP292 implementation scope: **100% landed** (source changes, regression file, package script, Node 24 workflow, architecture map and checkpoint docs).
- WP292 validation: **0% passing evidence confirmed** (the Actions run is failed and step logs are unavailable through the connector; the test command/typecheck outcome is unresolved).
- Independent hypothesis → assessor → P23 candidate chain: **partially implemented** (bounded storage/read-only handoff landed; automatic assessor/evaluation/promotion remains open).
- Whole-organism readiness: **not assigned a precise percentage in this document**. Existing code and architecture map alone cannot establish that the whole autonomous life cycle is active or reliable; WP293 will establish numerator/denominator acceptance evidence before giving a defensible readiness score.
