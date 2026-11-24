# Workpass71 P0 — Spine-only verified SelfAuthorship parity

Base: `aspect/p0-memoryos2-selfauthorship-execution-20261124` @ `620b996e39f64b155566cd22cce154d4528869e9`  
Branch: `aspect/p0-spineonly-selfauthorship-runtime-20261124`

## Problem reproduced

The supported `spineOnly` public path bypassed the SelfAuthorship hooks added to the full OrganismCore path. It created a decision trace and accepted feedback, but never registered or settled the corresponding pending author decision. This caused the same organism to report different authorship depending on Core mode.

The new real-Core test first failed at the expected assertion: `spine-only decisions must be registered with canonical SelfAuthorship`.

## Implementation

- Register the selected spine-only action using the decision trace's exact ID in the canonical SelfAuthorship engine.
- Save the SelfAuthorship facet immediately after registration so pending intent uses the existing snapshot/restart path.
- On spine-only feedback, match the outcome to the current trace ID and use the existing verified-source predicate (`worldTransition`, `os`, `device`, `user`, `external-api`).
- Save the facet after outcome settlement; the ledger's one-shot matching keeps replayed outcomes idempotent.
- Treat explicit `externalGoal` as external in the spine-only autonomy score, constitutional `userPresent` input and decision trace attribution, just as the full path does.

## Scope

No second autonomy ledger, no new persistence file and no additional policy writer. Full-path behavior remains unchanged. This branch does not merge or publish a Release.
