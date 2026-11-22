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
- The included `NmcNLocalHttpPort` is an explicit loopback-only HTTP client for `http://127.0.0.1:8765/evaluate`; it rejects remote hosts, HTTPS, credentials, redirects and alternate paths.
- The included `scripts/nmcn_sidecar.py` pins the imported package to exactly NMCN 0.4.2 and maps the JSON request to the real Python `NeuroCoreRuntime.evaluate()` API. It binds only to `127.0.0.1`, accepts a 16 KiB bounded request, validates fixed vector dimensions and cycle-bound references, and does not log payloads.
- The sidecar restores the newest valid NMCN checkpoint generation at startup and keeps three generations. It checkpoints every eight requests by default and on graceful shutdown; `--checkpoint-dir` and `--checkpoint-every` are configurable. These files contain only NMCN auxiliary adaptive state, never Qwen weights or NK1 canonical state.
- Start it from an extracted NMCN 0.4.2 package directory with `PYTHONPATH=/path/to/NeuroCore_Neural_Evolution_0.4/src python /path/to/NK1/runtime/neuro-kurisu/scripts/nmcn_sidecar.py --port 8765`. Then configure the NK1 server environment with `NK1_NMCN_SIDECAR_URL=http://127.0.0.1:8765/evaluate` and optionally `NK1_NMCN_SIDECAR_TIMEOUT_MS=80`. The canonical server composition creates `NmcNLocalHttpPort` only when the URL variable is explicitly set; without it, NMCN remains disabled. NK1 still does not launch processes or open listeners implicitly.

## Verification boundary

The focused regression covers the numeric projection, schema dimensions, strict decision normalization, malformed response rejection and timeout cancellation. It does not prove that a real Python sidecar is installed, connected, durable or faster on the target F6 device. Device integration and NMCN verified-outcome learning remain separate gates.
