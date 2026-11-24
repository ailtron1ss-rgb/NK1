# Release Notes B287

## B287 — Relationship Value Development

- Added `B287RelationshipValueDevelopmentCore`.
- Integrated relationship-specific neural values into action and goal arbitration.
- Added delayed local plasticity, eligibility traces and replay.
- Added person-specific personality evidence bridge.
- Added Core persistence/migration.
- Added standalone, hidden, Core and migration tests.
- Added external architecture comparison research document.
- Strengthened Core action contribution with bounded relationship/goal weighting.
- Kept relationship-to-action as an auxiliary bias instead of replacing the causal policy stack.

## Verification
Typecheck, B287 functional tests, B286/B285 selected regressions, full audit, architecture, integrity, forensics, hygiene, syntax, contract, lock, release-source, doctor, brain audit and archive verification are required for release.
