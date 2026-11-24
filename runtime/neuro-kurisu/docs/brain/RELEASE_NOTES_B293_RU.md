# Release notes B293

## Main change
Added `B293SelfWorldPredictiveMicrocircuit` and integrated it with B290/B291/B292.

## Why
The previous architecture had persistence and executive continuity but lacked a small explicit neural substrate whose prediction is causally tied to actual self/world outcomes. B293 closes that gap without creating another personality owner.

## Performance repair
An initial integration caused a concurrency regression because B293 state was deeply snapshotted after every outcome and its action bias was recomputed for every candidate. Both were removed: action bias is computed once per neural step and checkpointing is moved to a slower timescale.

## Validation
Standalone neural test: PASS. Core integration: PASS. Typecheck/smoke/restart/concurrency/UI/server/audits/Live2D/subject UI: PASS.

## Boundary
1000-cycle mobile harness is not marked PASS on the host. Device-specific Termux verification is required.
