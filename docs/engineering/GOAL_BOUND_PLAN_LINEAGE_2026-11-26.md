# NK1 — Goal-bound plan lineage

Date: 2026-11-27
Canonical base: `workpass70-source@4d041f1e57ab85f746027a37ab14e09b6d34c52b`
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

Focused tests prove same-context acceptance, goal/world/decision mismatch rejection, chained step preconditions, expected successor shape, bounded fallback compatibility, and zero world-state mutation during planning. A real OrganismRuntime autonomous cycle also captures the live PlanEngine call and checks that the exact returned cycle decision ID/tick are passed to either beam search or the budget fallback. Existing planner, budget, fallback and ActionGateway tests remain part of the CI gate. The PR workflow installs pinned TypeScript 5.8.3 plus Node 22 type definitions and runs the existing strict `tsconfig.clean.json` semantic compiler check instead of relying on syntax stripping.

This is causal/engineering integrity, not a claim that goals are always correctly understood or plans are optimal.


## Plan payload integrity

Every plan is sealed with a SHA-256 fingerprint over its goal binding, ordered
steps (including actions, preconditions and expected outcomes), expected value,
search bounds and root lineage. The plan ID is derived from this fingerprint.
Admission re-hashes the payload before checking decision/goal/world lineage, so
a changed action or forecast cannot pass by retaining an otherwise valid
precondition. Step admission also re-projects the proposed action from its
recorded predecessor snapshot and compares the projected successor fields.
This is a corruption/tamper-detection checksum inside the runtime boundary, not
a digital signature or proof against an attacker who can rewrite both code and
integrity metadata.
## Verified-outcome plan revision (2026-11-27)

The planner now consumes a narrowly scoped revision hint from the immediately
preceding canonical CognitiveEventFabric cycle. It does not infer a correction
from free-form text, simulator output, an unaccepted plan, or a result whose
action cannot be tied to the selected/executed action receipt.

The revision gate requires all of the following:

- A goal-stage receipt must name the same selected goal, and the plan, action,
  and outcome events must carry the same plan ID, decision ID and goal ID; all
  four stages must belong to the immediately preceding tick.
- An accepted plan and a retained action-stage receipt whose action equals the
  action named by the outcome event.
- The outcome event must be external and explicitly classified as an external
  reality observation.
- Verification, independence, and evidence quality must each be at least 0.70.
- The predicted utility for the action actually executed and its observed
  outcome must differ by at least 0.25.
- Metacognitive revision readiness must be at least 0.35.

The prediction is read from the canonical decision's predictedOutcomes entry
for embodiedAction.action; the observed value is the grounded outcome from
that same cycle. The planner maps that ActionKind to its world-action equivalent
and excludes that one equivalent from the first beam-search expansion only.
The hint, source action, previous plan/decision, tick, predicted/observed values,
error and readiness are sealed into plan lineage. Admission requires the exact
same revision evidence that was used when building the plan.

This is deliberately a one-cycle planning adjustment, not a change to the
decision selector, not an actuation authorization, not a bypass of risk or
ActionGateway governance, and not a claim of complete adaptive decision
revision. If any provenance, identity, readiness, or action link is missing,
the planner runs its ordinary search unchanged.
