# Shared Future — NK1 implementation note

## Purpose

Shared Future turns the existing future-simulation and goal-planning hooks into a bounded scenario ledger. It stores alternatives, assumptions, goal references, consequences, points of no return, revision signals, and decision dependencies. It is a planning representation, not a forecast service and not an execution engine.

## Canonical ownership and persistence

The state owner is SharedFutureEngine, owned by the existing FutureSimulator. FutureSimulator.snapshot()/restore() is already included in OrganismCore's advanced persistence facet, so Shared Future uses that path rather than introducing a second database or second goal store. Goal links contain only canonical goal IDs, owner labels, and relationship types; they never clone or mutate the underlying goals.

## Ownership and consent

Scenarios and decisions are labelled user, system, or shared. The system may autonomously create system-owned drafts and propose system-owned decisions. User-owned and shared writes use the existing ActionGateway self-modification approval class and a one-shot, request-bound approval. A shared label also requires explicit confirmation in the approved request. User/shared decisions, irreversible decisions, and review resolutions cannot be silently accepted by an autonomous call.

## Review and uncertainty

Assumptions may expire. Date, metric-threshold, and manual signals can set reviewRequired and append a bounded reason/history record. Signals never rewrite goals or execute a plan. Alternative branches carry probabilities which must not sum above 1.001 in one alternative group. A review can confirm, defer, invalidate, or supersede the old scenario with an owned child scenario.

Runtime WorldModel2 rollouts update a stable system-owned draft called runtime-world-preview. It is explicitly marked as a model projection and independentlyVerified=false. This signal must not be presented as an observed fact, a calibrated probability, or a guarantee about the future.

## Decision safety

A decision is a record in the future plan only. Confirmation changes its status to accepted but executionStatus remains not-executed. Dependencies must already be accepted. An irreversible decision requires a compensation plan, explicit irreversible confirmation, and a human approval through ActionGateway. The feature does not invoke external APIs, write project files, migrate data, or execute commands.

## Bounds and verification

The ledger is bounded (48 scenarios, 128 decisions, 128 review records, 192 signal records, bounded nested arrays and text). Restore clamps old, missing, and oversized state. The focused regression exercises ActionGateway approval boundaries, scenario alternatives, ownership, decision dependencies, no-execution semantics, review signals, revision, WorldModel2 projection, snapshot round-trip, and legacy restore. The dedicated workflow runs that test and the runtime typecheck.
