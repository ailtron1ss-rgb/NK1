# Open Loop Radar — OmeStro idea 13

## Runtime ownership
OpenLoopRadar is a deterministic domain engine owned by OrganismRuntime. It does not infer commitments from memory, send notifications, schedule an extra loop, or execute user actions.

The runtime persists state in `<stateFile>.open-loops.json` using the existing FileStateStore atomic-write and backup semantics. The state loads during `OrganismRuntime.init()`, every accepted mutation is durably written before its result is returned, and the snapshot is included in runtime flush. Mutations use the existing serialized OrganismRuntime queue. If persistence fails, the in-memory snapshot is restored before the error is returned.

An invalid or unsupported outer snapshot fails closed. Restore reads only own data properties, rejects malformed and oversized data, removes cyclic dependency components and downstream dependants, and refuses over-capacity states.

## Obligation contract
- Only explicitly accepted records are registered. Memory entries and inferred intentions are not commitments.
- Each record tracks owner, type, provenance, due/expiry timestamps, bounded dependencies, priority, lifecycle status and surfacing history.
- A dependency is satisfied only by a fulfilled record with timestamped closure evidence. Blocked obligations cannot be marked complete or surfaced as actionable overdue tasks.
- Blocked → open transitions receive a distinct `dependency-unblocked` surfacing reason.
- Candidate diagnostics separate surfacing eligibility from suppression, exposing `snoozed`, `reservation`, `quiet-hours` and `cooldown` so the UI can explain why an item is currently hidden.
- Completion, cancellation and reopening are explicit operations. Completion requires evidence; cancellation and reopening require a reason.
- Optional idempotency keys deduplicate retried creates for 24 hours while retained; reusing a key for different content is a conflict.
- At capacity, only unreferenced terminal history may be pruned. Active obligations and the full transitive prerequisite ancestry of active obligations are never silently evicted.
- Per-obligation snoozing requires a future wake timestamp and a reason. It suppresses reminder delivery until the wake time, survives restart and releases any in-flight initiative reservation.
- Dependency lists can be explicitly repaired when a prerequisite is cancelled or superseded. Changes require a reason, reject missing/cancelled prerequisites and reject cycles before mutating the graph.

## Autonomous dialogue integration
The radar is connected to the existing `OrganismRuntime` spontaneous-dialogue path; it does not create a competing scheduler or force a new conversation by itself.
- When an existing autonomous social initiative is selected, the runtime scans for one actionable accepted obligation and reserves at most one item for that initiative.
- The reservation is persisted before language generation, suppresses duplicate surfacing, and carries a bounded 15-minute default lease.
- A generated message receives only a privacy-sanitized title/type/reason/owner projection. User-owned items are framed as user-accepted follow-ups; system-owned items are framed as the organism's own previously accepted intentions, never falsely attributed to the user. The prompt frames either as an optional check-in, not authorization or evidence of completion. The default compatibility behavior for older callers that omit owner is `user`.
- If generation or message staging fails, the reservation is released. An abandoned reservation expires after its lease so the obligation becomes eligible again after restart.
- The existing `POST /api/organism/proactive-message/ack` delivery acknowledgement also acknowledges the matching open-loop reservation and starts its reminder cooldown.
- Fulfilling, cancelling, reopening or snoozing a reserved obligation clears the reservation.

## Runtime and HTTP surface
Runtime methods: `registerOpenLoop`, `fulfillOpenLoop`, `cancelOpenLoop`, `reopenOpenLoop`, `snoozeOpenLoop`, `updateOpenLoopDependencies`, `scanOpenLoops`, `acknowledgeOpenLoopSurfaced`, `reserveOpenLoopForAutonomousInitiative`, `releaseOpenLoopForAutonomousInitiative`, `openLoopSnapshot`, and `openLoopDiagnostics`.

Authenticated routes:
- `GET /api/organism/open-loops` — read-only diagnostics, records and ranked candidates.
- `POST /api/organism/open-loops` — create only after `confirmed: true`; source and acceptance provenance are server-owned. Optional `idempotencyKey` makes retries safe.
- `POST /api/organism/open-loops/:id/complete` — requires explicit confirmation; server creates the user-confirmation receipt and ignores client-supplied evidence.
- `POST /api/organism/open-loops/:id/cancel` and `/reopen` — require explicit confirmation and a reason.
- `POST /api/organism/open-loops/:id/snooze` — requires confirmation, a future wake timestamp and a reason.
- `POST /api/organism/open-loops/:id/dependencies` — requires confirmation and a reason; replaces the dependency list after cycle and prerequisite validation.
- `POST /api/organism/open-loops/:id/surface` — accepts only `displayed: true`, then persists cooldown.
- Existing `GET /api/organism/proactive-message` and `POST /api/organism/proactive-message/ack` provide the autonomous dialogue delivery surface.

## Verification
`npm --prefix runtime/neuro-kurisu run test:open-loop-radar`
`npm --prefix runtime/neuro-kurisu run test:open-loop-radar-runtime`
`npm --prefix runtime/neuro-kurisu run test:open-loop-radar-http`
`npm --prefix runtime/neuro-kurisu run test:open-loop-radar-dialogue`

All four gates run from the existing `test:organism-smoke` CI path.
