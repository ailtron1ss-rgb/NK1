# NK1 — WorkPass: persistent personality restore integrity

**Date:** 2026-11-02  
**Branch:** `aspect/personality-state-restore-integrity-20261102`  
**Base:** `workpass70-source` at `608435493b4af3b4a222d385f1b77d978d18583b`

## Finding

`P2702PersistentPersonalityDynamics.restore` previously cloned and spread the complete persisted object before sanitizing selected arrays. This made accessor-backed/proxy snapshots capable of throwing during restore and allowed mismatched name/value arrays or unknown names to alter the identity vector's interpretation. Protected canon names were not fixed to the canonical profile at restore.

## Implemented

- Rebuild state field-by-field from own data properties only; no caller-owned object spread or structuredClone.
- Fix invariant, adaptive-trait and value names to the canonical default profile. Restore vectors only when their names and lengths match.
- Require exact-length finite vectors for self-beliefs, uncertainty, tensions and named traits.
- Clamp scalar continuity, stability, drift, plasticity and reward signals.
- Bound counters and relationship-trust entries; reject malformed identifiers and prototype keys.
- Restore only known action-preference keys and finite numeric values.
- Add direct regressions for valid round-trip, throwing accessors, malformed vectors, injected identity names, hostile map keys and revoked proxies.
- Add a dedicated CI workflow for the regression and runtime typecheck.

## Verification boundary

CI is configured by the new workflow. No local runtime execution was available in this editing pass; the exact PR-head workflow must pass before merge. This branch is separate from the affect-state branch and does not change the Release ZIP.

## Next closure work

1. Validate P2702's beforeDecision/afterOutcome causal updates on multi-session held-out trajectories.
2. Ensure autobiographical memory writes preserve the evidence reference and distinguish user-confirmed identity claims from inferred behavioral hypotheses.
3. Couple identity drift to bounded plasticity and rollback using independent evaluation, not only self-reported metrics.
4. Exercise personality restoration through full OrganismCore restart and model-switch continuity.
