# NK1 ↔ NMCN 0.4.x runtime integration

## Scope

This slice connects the separately developed Python NMCN runtime to the canonical NK1 cognitive cycle through an optional host-injected port. It does not copy the Python implementation into TypeScript and does not create a second memory, world-state, learning-governance or action-execution owner.

## Runtime contract

- Host supplies `RuntimeConfig.nmcnRuntime`, implementing `evaluate(input, { signal })` by calling the NMCN `NeuroCoreRuntime.evaluate()` entry point.
- NK1 projects one canonical cycle into a fixed numeric-only schema: 8 state features, 6 action features and an 8-feature fast-memory key. The projection contains no user text, prompts, memory payloads, credentials or raw conversation.
- The NMCN input signal uses the Python package's `CognitiveSignal` fields. The host configures NMCN with `state_dim=8`, `action_dim=6` and `FastWeightMemory(dimension=8)`.
- NMCN's returned `CognitiveCycleDecision` is normalized at the boundary. Unknown, malformed, oversized or late responses become `null`; the canonical NK1 cycle continues.

## Authority and data ownership

- NMCN may request extra language deliberation. NK1 honors that hint only when the canonical execution plan permits slow cognition, the body is awake, resource allocation is not critical, and the canonical cognitive budget is neither sleep nor defer.
- NMCN cannot select or execute a tool, mutate the environment, write MemoryOS2, update P23/P26 candidates, or grant ActionGateway approval.
- NMCN predictions and sidecar health are not evidence that an external action succeeded. Only NK1's existing external postcondition/evidence path can establish real outcomes.
- No NMCN memory-write or world-model training feedback is wired in this slice. The Python package's own evidence/privacy gates remain mandatory for any future training path.

## Failure and operations

- Integration is opt-in; without `nmcnRuntime`, NK1 behavior is unchanged.
- Default sidecar response budget is 80 ms; configurable `nmcnTimeoutMs` is clamped to 10–1000 ms. Timeout aborts the host request and degrades to canonical NK1 behavior.
- Host transport failures and malformed decisions fail closed and are journaled; they do not fail the cognitive cycle.
- The adapter is transport-neutral. The host may use an embedded Python runtime or a separately managed local sidecar, but NK1 does not launch processes, open network listeners, or assume Python is installed.

## Verification boundary

The focused regression covers the numeric projection, schema dimensions, strict decision normalization, malformed response rejection and timeout cancellation. It does not prove that a real Python sidecar is installed, connected, durable or faster on the target F6 device. Device integration and NMCN verified-outcome learning remain separate gates.
