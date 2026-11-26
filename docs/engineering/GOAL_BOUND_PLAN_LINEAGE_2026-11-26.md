# NK1 — Goal-bound plan lineage

Date: 2026-11-26
Canonical base: `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`
Aspect branch: `aspect/cognitive-goal-plan-lineage-20261126`

## Existing foundation retained

This change extends the existing `PlanEngine` and the already-connected runtime route. It does not create another planner, goal owner, world model, budget scheduler, action selector, or ActionGateway. P67/P68 remain the goal genesis/lifecycle owners; CognitiveExecutionPlanner remains the compute scheduler; P61/P64 and the governed decision remain the selection boundary.

## Gap addressed

Previously a plan identified a goal by `goalId` but did not carry an integrity binding to the exact goal revision, decision ID/tick, or world snapshot from which the beam search was built. Plan steps also had reward/confidence but no explicit predecessor precondition or projected successor receipt.

## Contract

- The plan lineage binds the canonical decision ID and decision tick.
- The goal fingerprint covers the exact goal fields used by the plan.
- The world fingerprint binds the exact root world snapshot.
- Each step has a predecessor world tick/location/fingerprint and a typed expected outcome.
- The budget fallback follows the same lineage contract.
- Runtime checks lineage, exact first-step preconditions, and simulator validity before using a plan for rollout; stale, mismatched, or impossible projected steps degrade to a non-mutating `observe` projection.
- Existing goal selection, action arbitration, risk governance, and ActionGateway remain unchanged.

## Acceptance

Focused tests prove same-context acceptance, goal/world/decision mismatch rejection, chained step preconditions, expected successor shape, bounded fallback compatibility, and zero world-state mutation during planning. Existing planner, budget, fallback and ActionGateway tests remain part of the CI gate.

This is causal/engineering integrity, not a claim that goals are always correctly understood or plans are optimal.
