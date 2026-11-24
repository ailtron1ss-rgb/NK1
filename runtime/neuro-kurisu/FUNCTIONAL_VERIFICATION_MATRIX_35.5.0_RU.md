# FUNCTIONAL VERIFICATION MATRIX — Neuro-Kurisu 35.5.0

## Static inventory
- Source TS/TSX: 258
- Function-like declarations: 2333
- Declarations with executable body: 2304
- Exported declarations detected: 102
- Zero-reference token candidates: 385
- One-or-less-reference candidates: 746

## Behavioral verification
- Historical regression suites: retained and re-run for the latest developmental/runtime chain where feasible.
- Safe zero-argument OrganismCore public surface: 177/177 invoked successfully after initialization; 2 mutating methods intentionally excluded from the generic probe.
- Previously unreferenced exported helpers: 4 direct behavior contracts added and passing.
- Dead non-exported helper `authorshopSafe`: removed after zero-reference confirmation.
- Current release/runtime/type/architecture/security/integrity gates are required for release acceptance.

## Important epistemic boundary
A zero-reference method is not automatically broken: public APIs may be called by external hosts, and parameterized methods require semantically valid inputs. Blind invocation of every method would create false failures and can mutate organism state. Such methods are marked as scenario-dependent rather than falsely certified.
