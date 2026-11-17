# Open Loop Radar — OmeStro idea 13

## Runtime ownership
OpenLoopRadar is a deterministic domain engine owned by OrganismRuntime. It does not create inferred commitments, issue notifications, schedule an additional loop, or execute user actions.

The runtime stores its state in the sidecar file `<stateFile>.open-loops.json` using the existing FileStateStore atomic-write and backup semantics. The state is loaded during `OrganismRuntime.init()`, persisted after every accepted mutation, and included in the runtime flush boundary. Mutations are serialized through the existing OrganismRuntime queue. If a mutation cannot be saved, the in-memory snapshot is restored before the error is returned.

## Obligation contract
- Only explicitly accepted records are registered. Memory entries and inferred intentions are not commitments.
- Each record tracks owner, type, source, due/expiry timestamps, bounded dependencies, priority, lifecycle status and surfacing history.
- A dependency is satisfied only by a fulfilled record with timestamped closure evidence.
- Blocked tasks are visible in diagnostics but are not surfaced as actionable overdue reminders.
- When a prerequisite is fulfilled, dependants transition from blocked to open and get a distinct `dependency-unblocked` surfacing reason.
- Completion, cancellation and reopening are explicit operations. Completion requires evidence; cancellation and reopening require a reason.
- Scans are side-effect-free. The host acknowledges a displayed item separately, persisting its reminder cooldown.
- Quiet-until and reminder cooldown suppress surfacing without deleting obligations.
- Restore reads only own data properties, rejects accessor-backed records, removes cyclic dependency components and downstream dependants, and fails on over-capacity states.
- At capacity, only unreferenced terminal history may be pruned. Active obligations and terminal prerequisites still referenced by active records are never silently evicted.

## Runtime surface
- `registerOpenLoop(input)`
- `fulfillOpenLoop(id, evidence)`
- `cancelOpenLoop(id, reason)`
- `reopenOpenLoop(id, reason)`
- `scanOpenLoops(options)`
- `acknowledgeOpenLoopSurfaced(id)`
- `openLoopSnapshot()`
- `openLoopDiagnostics()`

Cadence and UI delivery remain host-owned; no parallel scheduler is introduced.

## Verification
From the repository root:
`npm --prefix runtime/neuro-kurisu run test:open-loop-radar`
`npm --prefix runtime/neuro-kurisu run test:open-loop-radar-runtime`

Both gates are included in the existing `NK1 Unified organism runtime` smoke path.
