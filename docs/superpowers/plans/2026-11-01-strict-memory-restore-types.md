# WorkPass84 — Strict Memory Restore Numeric Types

## Base
`workpass70-source` at `142df54b6880805092bfd8e861798240747b0797`.

## Tasks
1. Add a real MemoryOS2 restore fixture containing numeric-looking strings in timestamps, validity bounds, salience, confidence, revision history and nested evidence-source provenance.
2. Confirm the targeted memory-integrity workflow fails at the new assertion while runtime typecheck passes.
3. Tighten the shared finite-number helper; independently validate revision-history timestamps and confidence without coercion.
4. Document the compatibility boundary in CHANGELOG.
5. Verify exact-head memory-integrity and core-regression workflows; review the diff before considering integration.

## Constraints
- Do not change `main` or the Release ZIP.
- Do not write to MongoDB, Supabase, Redis or other external stores.
- Keep the PR Draft until validation and review are complete.
- Do not claim retrieval uplift or autonomous-behavior readiness from these restore-integrity checks.
