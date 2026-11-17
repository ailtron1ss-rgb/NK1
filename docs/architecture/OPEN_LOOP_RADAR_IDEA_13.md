# Open Loop Radar — implementation notes

OmeStro idea 13: radar for unfinished obligations.

## Contract
- Only explicitly accepted records enter the registry; memories and inferred intentions are not commitments.
- Records have an owner, kind, source, optional due/expiry timestamps, bounded dependencies, priority, and lifecycle status.
- A dependency is satisfied only by a fulfilled record with explicit closure evidence.
- Fulfillment requires timestamped user confirmation, execution receipt, or external confirmation. A stored note alone is not closure.
- Cancellation requires a reason; reopening requires a reason and clears previous closure evidence.
- Scan is side-effect-free. It returns risk-ranked candidates; the host decides whether and how to surface them.
- Quiet-until and reminder cooldown suppress surfacing without deleting or mutating obligations.
- Persistence is an explicit versioned snapshot; restore validates records and recomputes dependency status.

## Integration boundary
OpenLoopRadar is a deterministic domain engine. It intentionally does not send notifications, schedule jobs, make network calls, or create commitments on behalf of a user. The host runtime should persist snapshot() alongside organism state and call scan() at a bounded cadence. The first integration pass establishes the stable engine contract; wiring into the canonical cognitive-cycle owner must use that owner's existing persistence and cadence boundaries rather than creating a second scheduler.

## Verification
Run from repository root:
node --experimental-strip-types runtime/neuro-kurisu/tests/open-loop-radar-contract.mjs
