# Neuro-Kurisu SUPER — WorkPass 12: confidence-aware Memory 2.0 review gates

**Date:** 2026-10-10
**Base archive:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS11_2026-10-10.zip`
**Base SHA-256:** `e167873c2254d7097cf2a4e479020a59ac55da49e830113e1ea5ebe8336771ce`
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223
**Scope:** safer evidence gates for MemoryOS2 evaluation; atomic report publication; no production memory write and no automatic promotion.

## Implementation

1. Added a confidence-aware MRR non-inferiority gate. A candidate cannot be considered eligible if its paired-bootstrap MRR lower bound crosses the configured maximum regression tolerance, even when its point estimate looks acceptable. This is checked alongside the existing recall-uplift confidence gate and safety/data integrity gates.
2. Multi-seed sensitivity now requires the MRR lower bound to stay within the tolerance for every seed. Each per-seed report contains the MRR confidence gate and a list of failed gates.
3. Single-run reports include explicit promotion gates for seed validity, corpus and dataset integrity, provenance, evidence size, recall threshold, recall confidence, MRR point estimate, MRR confidence and unsafe candidate output. The summary reason remains concise while all failures remain visible.
4. Explicit bootstrap seeds outside the positive uint32 range are invalid. They use a deterministic diagnostic fallback but block promotion; the report records input validity and effective seed rather than silently claiming the supplied seed was used.
5. CLI report publication is now atomic and exclusive. It writes and flushes a temporary file in the destination directory, publishes it using an atomic no-overwrite link, then removes the temporary file. On handled failure it cleans temporary output and does not truncate/replace an existing report.
6. Added regression cases for a deceptively acceptable MRR point estimate with a failing confidence bound, invalid direct seed values, multi-seed MRR gate summaries, temporary-file cleanup and existing-output protection. Added the repeatable `audit:workpass12` command.

## Verification run

- `npm run test:memory-retrieval-benchmark` — PASS. Fixture confirms point MRR is inside tolerance while MRR CI fails the non-inferiority gate; promotion remains blocked.
- `npm run test:memory-retrieval-experiment` — PASS, including CLI invocation, three bootstrap seeds, no live-snapshot mutation, atomic report publication, rejection of overwrite, cleanup and invalid-seed argument rejection.
- `npm run typecheck` — PASS (`TYPECHECK=PASS mode=tsc`).
- `npm run audit:server-imports` — PASS: 10 imports checked, 0 missing.
- `npm run audit:ui-api-linkage` — PASS: 124 client routes, 48 Runtime Atlas surfaces, 5 required seams, 0 missing links.
- `npm run server:smoke` — PASS.
- The aggregate `npm run audit:workpass12` completed with exit code 0.

## Limits retained honestly

- Only synthetic regression fixtures were available. No real independently labeled MemoryOS2 corpus or temporal holdout was evaluated, so no production recall/MRR uplift is claimed.
- Bootstrap seeds alter resampling only; they do not retrain retrieval or constitute independent training seeds.
- A passing review gate is eligibility for independent review only; `promotion.allowed` does not automatically become true in the multi-seed experiment.
- React/Vite production build, desktop/mobile/Live2D browser E2E, clean-room install and restore/upgrade/rollback, multi-hour soak, external-provider reconnect/postcondition tests and final SBOM/provenance remain release gates.

## Change boundary

`MemoryOS2` remains the canonical memory owner. The experiment operates against isolated snapshots and labelled inputs, does not infer ground truth from predictions, and cannot mutate production memory, identity or policy. Historical roadmap scores are not recalculated.
