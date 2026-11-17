# Open Loop Radar — OmeStro idea 13

## Runtime ownership
OpenLoopRadar is a deterministic domain engine owned by OrganismRuntime. It does not infer commitments from memory, send notifications, schedule an additional loop, or execute user actions.

The runtime persists state in `<stateFile>.open-loops.json` using the existing FileStateStore atomic-write and backup semantics. The state loads during `OrganismRuntime.init()`, every accepted mutation is durably written before its result is returned, and the snapshot is included in runtime flush. Mutations use the existing serialized OrganismRuntime queue. If persistence fails, the in-memory snapshot is restored before the error is returned.

An invalid or unsupported outer snapshot fails closed; it is not silently replaced with an empty registry. Restore reads only own data properties, rejects accessor-backed or malformed records, rejects oversized arrays, removes cyclic dependency components and their downstream dependants, and refuses over-capacity states.

## Obligation contract
- Only explicitly accepted records are registered. Memory entries and inferred intentions are not commitments.
- Each record tracks owner, type, source, due/expiry timestamps, bounded dependencies, priority, lifecycle status and surfacing history.
- A dependency is satisfied only by a fulfilled record with timestamped closure evidence.
- Blocked tasks remain visible in diagnostics but are not surfaced as actionable overdue reminders and cannot be marked fulfilled.
- When a prerequisite is fulfilled, dependants transition from blocked to open and get a distinct `dependency-unblocked` surfacing reason.
- Completion, cancellation and reopening are explicit operations. Completion requires evidence; cancellation and reopening require a reason.
- Scans are side-effect-free. The host acknowledges a displayed item separately, persisting the reminder cooldown.
- Quiet-until and reminder cooldown suppress surfacing without deleting obligations.
- At capacity, only unreferenced terminal history may be pruned. Active obligations and terminal prerequisites still referenced by active records are never silently evicted.

## Runtime API
Runtime methods: `registerOpenLoop`, `fulfillOpenLoop`, `cancelOpenLoop`, `reopenOpenLoop`, `scanOpenLoops`, `acknowledgeOpenLoopSurfaced`, `openLoopSnapshot`, and `openLoopDiagnostics`.

Authenticated HTTP routes:
- `GET /api/organism/open-loops` — read-only diagnostics, records and ranked candidates.
- `POST /api/organism/open-loops` — create only after `confirmed: true`; source and acceptance provenance are server-owned.
- `POST /api/organism/open-loops/:id/complete` — requires `confirmed: true`; client evidence is ignored and the server records only user-confirmation evidence.
- `POST /api/organism/open-loops/:id/cancel` and `/reopen` — require explicit confirmation and a reason.
- `POST /api/organism/open-loops/:id/surface` — accepts only `displayed: true`, then persists cooldown.

The host owns cadence and UI delivery; no parallel scheduler is introduced.

## Verification
`npm --prefix runtime/neuro-kurisu run test:open-loop-radar`
`npm --prefix runtime/neuro-kurisu run test:open-loop-radar-runtime`
`npm --prefix runtime/neuro-kurisu run test:open-loop-radar-http`

All three Open Loop Radar gates run from the existing `test:organism-smoke` CI path.
