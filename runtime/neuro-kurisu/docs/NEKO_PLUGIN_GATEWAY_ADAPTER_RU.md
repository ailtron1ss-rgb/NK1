# N.E.K.O. plugin gateway adapter — NK1

Status: isolated adapter implementation; host transport and the live plugin registry are intentionally not wired by this change.

## Ownership

N.E.K.O.'s gateway pipeline is adapted as a boundary pattern:

`transport -> normalize -> policy -> route -> ActionGateway -> serialize`

NK1 remains authoritative for tool registration, input contracts, approval, idempotency receipts, execution, postcondition verification and audit. This adapter does not instantiate a second executor, persist a second receipt ledger, or let plugin code call registered executors directly.

## Request boundary

- Host explicitly supplies enabled protocols and an `authorize(request, tool)` policy. Construction fails when either is missing.
- Only own-data plain objects containing inert JSON values are accepted. Proxies, accessors, symbols, cycles, exotic prototypes, sparse arrays, prototype-pollution keys, excessive depth/property count and oversized payloads fail closed.
- `toolId` must be inside the caller's `pluginId.` namespace.
- `resource_read` requires a non-destructive tool and a capability ending in `.read` or `:read`.
- `event_push` is rejected until a host-owned event-bus adapter exists. It is never disguised as a tool call.
- External `autonomous` and `decisionId` claims are ignored. The host adapter calls NK1 with `autonomous: false`; the tool still passes through ActionGateway's current policy, approval and durable-receipt gates.
- Caller-provided `idempotencyKey` and one-shot `approvalId` are forwarded to ActionGateway; this adapter does not fabricate approval.

## Response boundary

The adapter returns only the safe tool result plus verification and outcome classification. Internal execution IDs, audit structures, approval snapshots and provider receipts are not exposed. Unsafe or oversized results are omitted while preserving the gateway's actual success/verification state.

## Not yet integrated

A host must still supply protocol transport, plugin-to-tool binding, capability policy, lifecycle/disable controls and an event-bus adapter. Enabling a protocol or installing a plugin is a separate host decision. No generic network listener or automatic plugin discovery is added here.

## Verification

- `tests/neko-plugin-gateway-adapter.mjs`: adapter contract, policy denial, namespace isolation, read-only route, event-push rejection, hostile inputs, bounds and safe result serialization.
- `tests/neko-plugin-gateway-real-action-gateway.mjs`: the same adapter path exercised against the actual NK1 `ActionGateway`.
- Dedicated CI runs both tests and runtime typecheck.
