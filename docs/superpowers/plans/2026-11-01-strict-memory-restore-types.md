# WorkPass84 — Strict Memory Restore Numeric Types

## Base
`workpass70-source` at `c6ab2f97e4922dc04d3d19ce2aae857824c21992`.

## Tasks
1. Add a real MemoryOS2 restore fixture containing numeric-looking strings in timestamps, validity bounds, salience, confidence, revision history and nested evidence-source provenance.
2. Confirm the original restore regression fails while runtime typecheck passes.
3. Tighten the shared finite-number helper; validate revision-history and nested evidence-source numeric fields without coercion.
4. Preserve evidence deduplication, freshness aggregation and lineage behavior.
5. Document the compatibility boundary in CHANGELOG.
6. Verify exact-head memory-integrity and core-regression workflows; review the diff before considering integration.

## Constraints
- Do not change `main` or the Release ZIP.
- Do not write to MongoDB, Supabase, Redis or other external stores.
- Keep the PR Draft until validation and review are complete.
- Do not claim retrieval uplift or autonomous-behavior readiness from restore-integrity checks.
