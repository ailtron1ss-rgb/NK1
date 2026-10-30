# WorkPass624 — governed tool input contracts (2026-10-30)

## Purpose

NK1 already routes tool execution through the canonical ActionGateway, which owns approvals, durable idempotency receipts, verification and audit. Before this pass each adapter still had to validate arguments on its own, so different integrations could enforce different boundaries.

This pass introduces a deliberately small, dependency-free, JSON-Schema-inspired subset at the shared gateway. It is opt-in: existing integrations keep their prior behavior until migrated, avoiding a risky all-at-once schema conversion.

## Added

- Object, array, string, number, integer, boolean and null types.
- Required fields, additional-property policy, object/array bounds, string length/pattern, numeric ranges, scalar enums, unique arrays and serialized-byte limits.
- Registration-time schema validation plus cloned/frozen contracts.
- Execution-time validation before approval consumption, durable receipt admission or executor invocation.
- Bounded path/code diagnostics; raw argument values are not copied into validation errors.
- Empty-object contracts for the real runtime no-argument registrations: Android listen, device status and simulated world observation.
- Regression test and core workflow step.

## Why it matters

The language model is not a trusted argument serializer. Each invocation must be validated by the authority that executes it, not by the caller that proposes it. A malformed mutating request is rejected before it consumes approval, writes a pending receipt or enters an executor. The same registered schema is exposed by listTools for future model-facing tool catalogs.

## Scope and limits

This is not full JSON Schema 2020-12 and does not claim MCP conformance. Unknown schema keywords are rejected rather than silently ignored. Accessors are rejected through property-descriptor inspection. Ordinary JavaScript reflection cannot guarantee side-effect-free inspection of hostile Proxy traps; untrusted callers should cross a serialized process boundary.

Output schemas, provider-specific timeouts, concurrency/rate budgets and catalog reachability remain separate work. A timeout on a mutating provider must remain an ambiguous outcome unless the provider proves no effect; it must not be auto-retried.

## Validation commands

    npm --prefix runtime/neuro-kurisu run test:tool-input-contracts-workpass624
    npm --prefix runtime/neuro-kurisu run typecheck

## Research references

- JSON Schema 2020-12: https://json-schema.org/specification
- JSON Schema validation vocabulary: https://json-schema.org/draft/2020-12/json-schema-validation
- MCP 2026-07-28 tools specification: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/2026-07-28/docs/specification/2026-07-28/server/tools.mdx
- OWASP LLM Prompt Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html

The references motivate the design. NK1's implementation is a limited native adaptation, not standards certification.


## WorkPass625 — validate tool outputs and stabilize the tool catalog

- Tool definitions can now declare an output contract alongside the input contract.
- Output validation runs only after executor entry. An invalid result is reported as executed-but-unverified, never as a pre-execution rejection; keyed operations retain their durable receipt and replay without re-running the external effect.
- listTools returns standard-shaped inputSchema/outputSchema fields and emits a deterministic ID-sorted catalog.
- The validator uses Node's native Proxy detection before reflection so hostile Proxy traps are rejected rather than invoked during contract/input inspection. Schema enum/required arrays are checked as dense data arrays.
- Regressions cover malformed output after executor entry, keyed replay without duplicate execution, deterministic catalog order, and proxy trap non-execution.


## WorkPass626 — adopt output contracts in live runtime registrations

- Android listen declares a minimal result contract for its success flag while preserving the nullable transcript field.
- Device telemetry declares typed freshness, evidence-source, sample identity and normalized metric fields. Undefined telemetry measurements are omitted rather than emitted as non-JSON properties; a device sample is only treated as fresh/verified when the source is Android Termux, staleness is zero, and a finite positive sample timestamp exists.
- World observation declares the simulator source, tick, independence key and success flag; its bounded additional observation payload is still checked for JSON safety/depth/size.
- These contracts make the gateway enforce schemas at two ends for the first live tool paths while keeping external ActionGateway verification as the authority for real-world consequences.
