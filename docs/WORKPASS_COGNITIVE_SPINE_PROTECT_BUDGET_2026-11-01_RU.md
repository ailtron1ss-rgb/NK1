# NK1 WorkPass — cognitive spine protective budget gate (2026-11-01)

## Defect and correction

The scheduler selected `protect` when budget mode was `sleep` or resource pressure exceeded its threshold, but the per-operation cadence gate could still run work on matching ticks. A high-urgency external event could force world rollout, shadow simulation and project work during protection.

`protect` is now a hard stop for all four optional secondary operations: research, world rollout, shadow simulation and project work. Their opportunity and skip counters still advance, making deferred work visible. External events remain available to core/reflex and governance loops outside this optional scheduler.

## Regression coverage

WorkPass39 verifies explicit sleep protection on a tick divisible by all normal cadences and resource-pressure-derived protection under urgent external input. It asserts all operations remain disabled and deferrals are accounted for.

## WorkPass39 integration repair

Enabling WorkPass39 exposed a stale reality-boundary fixture that passed empty before/after contexts to `WorldTransitionForOrganism`. The previous runtime could update ensemble/world-model state and then throw while dereferencing `transition.after.objects.length`, leaving partial model updates.

The runtime now validates the full transition before the first model mutation: before/after context shape, required arrays, bounded facts/events/objects, finite numeric signals and monotonic context ticks. The fixture supplies valid contexts, and a new regression verifies malformed post-state rejection leaves the world-learning snapshot unchanged.

The unified organism runtime workflow runs `npm run test:big-pass-39` alongside typecheck, motivation, perception, planner, continuity and organism-smoke gates.

## Limits

These changes validate scheduler/resource policy and world-feedback input integrity. They do not establish measured Android battery draw, thermal throttling behavior, production background execution or cognitive quality improvement.
