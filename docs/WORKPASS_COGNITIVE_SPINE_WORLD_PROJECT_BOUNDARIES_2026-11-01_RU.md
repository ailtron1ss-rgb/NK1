# NK1 WorkPass — cognitive spine, world feedback and project-tool boundaries (2026-11-01)

## Protective resource gate

The cognitive spine scheduler now treats `protect` as a hard budget boundary for optional research, world rollout, shadow simulation and project operations. External urgency cannot bypass the protection mode; core/reflex and governance handling remain outside this secondary-work scheduler. Opportunity and skip counters remain visible.

## World feedback integrity

Action outcomes are rejected before any ensemble, contextual or latent-world mutation unless the complete transition is structurally valid. Both WorldContext snapshots require bounded facts/events/object collections, finite metrics, valid tick values and monotonic before/after ticks.

The WorkPass39 reality-boundary fixture covers malformed object arrays and rewound world ticks, and verifies that rejected feedback leaves the world-learning snapshot unchanged.

## Project tool bridge

The project executor checks exact active-step tool binding before the project allowlist and destructive-action policy. The previous fixture incorrectly called an arbitrary `project.safe` tool while its unresolved plan step requires `organism.project.evidence`; the call was rejected at the preferred-tool mismatch guard, before reaching the safety policy.

The corrected fixture runs the canonical safe evidence reader for the active step. A separate destructive fixture binds its active step to a deliberately destructive tool and verifies that the project destructive-action guard rejects it before execution.

## Cognitive tick invariant

The simulator and device feedback samples are separated by a new observation tick. B272's one-outcome-credit-per-tick invariant remains intact.

## CI

The unified organism runtime workflow runs `test:big-pass-39` after the planner restore/execution boundary. This suite now exercises spine units, world-feedback reality boundary, project-tool routing and destructive-operation denial.

## Non-claims

These tests establish scheduler policy and integration boundary behavior. They do not establish Android power/thermal profiles, device soak, real-world project execution or subjective consciousness.
