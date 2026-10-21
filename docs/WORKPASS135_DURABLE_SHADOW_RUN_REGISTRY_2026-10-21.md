# WorkPass135 — durable trusted shadow-run registry (2026-10-21)

## Implementation

- Added `AtomicFileTrustedSkillShadowRunRegistry`, a durable, versioned registry of trusted run/task context supplied by the execution supervisor before shadow evidence is evaluated.
- The context-bound evidence verifier can now resolve the expected run ID, task ID, seed, manifest fingerprint and runtime version from a persisted source independent of the signed receipt.
- Registrations are idempotent for identical contexts and reject conflicting reuse of a run/task identity. Writes use an exclusive lock, temp file, fsync and atomic rename; lock contention, malformed JSON and invalid schema fail closed.
- Added an in-memory implementation for isolated tests, not production persistence.
- Added a regression covering restart recovery, idempotent registration, conflict rejection, signed receipt/context binding, unknown run rejection, lock contention and corrupt-state rejection.

## Boundaries

- **IMPLEMENTED:** durable registry and verifier adapter surface; regression source and CI wiring committed.
- **NOT VERIFIED:** tests, TypeScript typecheck and exact-head Actions have not yet been observed passing.
- **OPEN / P0:** the actual production execution supervisor must register context before accepting a receipt; production key provisioning and authenticated human/approval authority must be wired to the sole skill lifecycle bootstrap. This pass does not claim the full activation call graph is closed or that learning quality improved.
- The test-only signing helper remains test-only; production private keys must not be stored in the runtime.

## Next code priorities

1. Wire this registry and trusted key configuration into the single runtime skill lifecycle bootstrap, preserving default-deny when configuration is missing.
2. Audit all activation paths and prove they cannot bypass the versioned candidate store or explicit authenticated approval.
3. Execute the owning learning suite/typecheck on a functioning runner; then connect the gated candidate path to real shadow task outcomes and compare against the frozen baseline.
