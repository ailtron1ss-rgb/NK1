# Shared Future — NK1 implementation note

## Purpose

Shared Future turns the existing future-simulation and goal-planning hooks into a bounded scenario ledger. It stores alternatives, assumptions, goal references, consequences, points of no return, revision signals, and decision dependencies. It is a planning representation, not a forecast service and not an execution engine.

## Canonical ownership and persistence

The state owner is SharedFutureEngine, owned by the existing FutureSimulator. FutureSimulator.snapshot()/restore() is already included in OrganismCore's advanced persistence facet, so Shared Future uses that path rather than introducing a second database or second goal store. Goal links contain only canonical goal IDs, owner labels, and relationship types; they never clone or mutate the underlying goals. At runtime, creation validates every referenced ID against OrganismCore's persisted canonical goal collection; missing goals fail closed.

## Ownership and consent

Scenarios and decisions are labelled user, system, or shared. The system may autonomously create system-owned drafts and propose system-owned decisions. User-owned and shared writes use the existing ActionGateway self-modification approval class and a one-shot, request-bound approval. A shared label also requires explicit confirmation in the approved request. User/shared decisions, irreversible decisions, and review resolutions cannot be silently accepted by an autonomous call.

## Review and uncertainty

Assumptions may expire. Date, metric-threshold, and manual signals can set reviewRequired and append a bounded reason/history record. Metric signals use hysteresis: a threshold must recover to the safe side before a fresh crossing can fire; manual signals re-arm after review, while date signals remain one-shot. Deferred reviews are re-queued by the organism's canonical tick clock and are visible through a read-only ActionGateway review-list tool. Signals never rewrite goals or execute a plan. Alternative branches carry probabilities which must not sum above 1.001 in one alternative group. A review can confirm, defer, invalidate, or supersede the old scenario with an owned child scenario.

Runtime WorldModel2 rollouts update a stable system-owned draft called runtime-world-preview. It is explicitly marked as a model projection and independentlyVerified=false. This signal must not be presented as an observed fact, a calibrated probability, or a guarantee about the future.

## Decision safety

A decision is a record in the future plan only. Confirmation changes its status to accepted but executionStatus remains not-executed. Dependencies must already be accepted. An irreversible decision requires a compensation plan, explicit irreversible confirmation, and a human approval through ActionGateway. The feature does not invoke external APIs, write project files, migrate data, or execute commands.

## Bounds and verification

The ledger is bounded (48 scenarios, 128 decisions, 128 review records, 192 signal records, bounded nested arrays and text). Restore clamps old, missing, duplicate, and oversized state, removes orphaned history links, repairs parent cycles/depth, and preserves backward compatibility for snapshots that predate review deadlines or signal arming. Every ledger-mutating ActionGateway tool requires a stable idempotency key. The ephemeral WorldModel2 preview expires quietly after its freshness window and is revived by the next rollout. The focused regression exercises ActionGateway approval boundaries, scenario alternatives, ownership, decision dependencies, no-execution semantics, review signals, revision, WorldModel2 projection, snapshot round-trip, and legacy restore. The dedicated workflow runs that test and the runtime typecheck.


## Outcome feedback and calibration

A consequence can receive one bounded outcome record through the organism tool surface. The record freezes the consequence probability at observation time, stores the outcome time, reporting actor, and a non-empty evidence reference, and computes the squared Brier error: (p - y)^2, where p is the stored forecast probability and y is 1 for occurred or 0 for not occurred. The aggregate mean Brier score is descriptive calibration telemetry over recorded outcomes only; it is not proof of predictive skill without sufficient representative samples, independent labels, and a holdout protocol. A consequence cannot be counted twice, outcome records are not silently evicted at capacity, and a system actor cannot report an outcome for a user/shared-owned scenario. Restore revalidates scenario/consequence references, de-duplicates records, recomputes the score from the frozen probability, and always forces independentlyVerified=false. Evidence references are retained for later audit; the engine does not fetch or independently validate them.

Outcome reads are exposed as organism.future.outcomes.list; writes use organism.future.outcomes.record with ActionGateway idempotency. A write creates an observation record only: it does not change goals, scenario probabilities, decision state, or execute a plan. Review revision now promotes only a draft or contingency child, preventing terminal/active scenarios from being reactivated as a successor.


## Canonical action-to-outcome integration

Shared Future decisions may bind to one canonical OrganismCore decision trace, one ActionGateway tool, one scenario consequence and one expected postcondition. Binding is accepted only when the decision trace exists in the canonical persisted organism trace set; one trace cannot be bound to multiple Shared Future decisions. Merely proposing or accepting a Shared Future decision does not execute the action.

The integration runs inside the existing OrganismCore external-observation path. It does not infer a decision ID from an execution ID and does not treat a tool's successful return as an outcome. The existing Reafference gate must first correlate the exact action execution receipt and decision trace, verify the postcondition, and establish independent external evidence. Positive outcomes require at least one independent eligible source; contradictions require at least two independent sources. Only evidence attached to that exact execution/tool projection is passed to Shared Future. Generic user/system outcome reports remain explicitly unverified and cannot enter this path.

A verified record stores the Shared Future decision ID, canonical organism decision ID, tool ID, execution ID, triggering observation ID, evidence observation IDs, source classes, source IDs, independence keys, expected/observed postconditions and the frozen forecast probability. Brier score is calculated from that frozen probability. The record remains an observation/calibration result; it does not execute actions or silently rewrite the forecast probability.

On restore, independentlyVerified is re-established only if the persisted Shared Future binding still points to an accepted decision, the canonical OrganismCore trace still exists, and OutcomeCognitionFabric still contains matching external observations for the exact execution and tool with the stored source identities, confidence, postcondition and direction. Missing/tampered verification projections downgrade the record to restored-unverified. Legacy snapshots continue to restore without action bindings or outcome evidence.

The unified organism runtime regression now runs both Shared Future scenario/consent tests and the end-to-end verified-action integration test, followed by the existing runtime typecheck.
