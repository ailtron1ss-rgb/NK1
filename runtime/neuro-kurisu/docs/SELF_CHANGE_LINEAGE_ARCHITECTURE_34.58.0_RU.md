# SELF-CHANGE LINEAGE — 34.58.0

## Canonical ownership

- **ValueEvolutionEngine** — owner of evidence-gated value revision.
- **SelfAuthorshipEngine** — owner of authored revision record.
- **IdentityCausalityGraph** — derived owner of causal lineage projection.
- **EventLog** — event-sourcing projection of the revision.
- **IdentityTrajectoryEngine** — developmental/narrative carry-over projection.
- **OrganismCore** — integration coordinator, not truth owner.

## Contract

A value revision becomes an explicit developmental self-change only through:

`verified revision → apply → authorship record → causal self-change lineage → event sourcing → trajectory chapter`

The integration point is `OrganismCore.applyVerifiedValueRevision`.

## Safety

The binding does not bypass ValueEvolution thresholds, protected value floors, P60 identity governance or evidence requirements. No revision is invented by the binding layer.

## Why this matters

This removes an architectural ambiguity: a value could previously change numerically while its role in the organism's developmental history was only implicit. The new lineage makes the computational transition inspectable and testable without claiming subjective experience.

## Falsifiability

A stronger claim would require showing that removing the binding changes future developmental behavior while holding lower-level value revision fixed. That ablation is not yet completed and remains future work.
