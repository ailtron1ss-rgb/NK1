# NK1 unified cognitive runtime integration map

This is a cross-branch integration contract, not a claim that every edge is already wired. Keep the existing runtime as the single source of truth; do not create duplicate memory, learning, or agency subsystems.

## Canonical cycle

Perception and event intake → state estimation and belief update → appraisal against drives and goals → candidate plan → ethical/capability gate → canonical ActionGateway → observed action receipt → postcondition verification → causal outcome ledger → reflection and memory consolidation → bounded skill-revision proposal → independent evaluation → authorized promotion.

Every transition carries a stable decision/event ID, timestamp, source/provenance, and correlation ID. The final action receipt and verified postcondition—not the planner's intention—are authoritative evidence of what happened.

## Shared substrate and ownership

- **Core / integration:** owns cycle coordinator, event identity, cancellation, budgets, and causal links. Other branches must not bypass the canonical action gateway.
- **Memory:** owns episodic/semantic/procedural stores, retrieval ranking, consolidation, provenance, and retention. Learning consumes evidence references rather than writing duplicate stores.
- **Learning:** owns candidate generation, paired evaluation, holdout isolation, promotion proposals, and skill versioning. It cannot self-authorize activation.
- **Perception:** emits timestamped observations with confidence and uncertainty; it cannot silently turn inference into verified fact.
- **Personality / motivation / emotions:** provide persistent identity, goals, drives, and appraisal signals as planning inputs; no subsystem may directly execute tools.
- **Feedback:** reconciles action receipts with observed postconditions and outcomes, including failures and delayed effects.
- **Embodiment:** renders shared internal state and confirmed actions; avatar animation is a projection, not a second source of organism state.
- **Useful functions:** expose capabilities through typed contracts and the same gateway, with explicit permission, timeout, retry, and receipt policy.
- **Experiments:** stores frozen protocols, seeds, holdout fingerprints, and raw results; experiment outputs do not become production defaults without the learning promotion gate.

## Required shared contracts

1. Decision ticket: decision ID, goal ID, belief snapshot, chosen action, policy version, budget, and expiry.
2. Action receipt: ticket ID, tool/action ID, start/end timestamps, status, output reference, and side-effect classification.
3. Postcondition evidence: ticket ID, expected predicate, observed predicate, source, confidence, and verification time.
4. Outcome record: decision ID, receipt ID, postcondition IDs, reward/cost dimensions, provenance, and supersession links.
5. Learning proposal: candidate hash, parent hash, evidence-manifest hash, holdout fingerprint, regression report, and explicit activation authorization.

## Integration order

P0: enforce decision-ticket continuity through ActionGateway → receipt → postcondition → outcome ledger.
P1: bind causal outcome IDs to replay and memory consolidation; reject duplicate or orphan evidence.
P2: bind Hermes/P23 candidate generation to the evidence ledger and independent multi-seed evaluator.
P3: use the same state snapshot to synchronize motivation, emotion, personality, and avatar projection.
P4: add active-perception and initiative scheduling with budget, cooldown, ethical and capability checks.
P5: validate the whole path with fault injection, restart recovery, holdout-contamination tests, and unattended initiative soak.

## Definition of integrated

A component is integrated only when invoked by the canonical runtime, consumes/produces the shared contract, persists recoverable evidence, has a failure path, and has a regression test. A file existing in the repository or a passing isolated unit test is insufficient.
