# P5 Final Audit — Neuro-Kurisu Clean 3.0.0

Дата: 2026-08-25

## Release surface
- Application: 3.0.0
- Organism Core: 6.0.0-research
- State schema: 7
- Runtime/build npm dependencies: 0
- package-lock: v3, real zero-dependency tree
- Canonical runtime: `src/organism`
- Legacy snapshot: `legacy-original/` (provenance only)

## Static verification
- source files: 66
- canonical files: 46
- missing relative imports: 0
- runtime import cycles: 0
- legacy leakage: 0
- research leakage into canonical: 0
- duplicate imports: 0
- duplicate exports: 0
- unexpected dynamic code: 0
- npm script targets: 0 missing

## Automated release checks
- `npm ci --offline`: PASS
- `npm run lock:verify`: PASS
- `npm run organism:smoke`: PASS
- `npm run organism:autonomy`: PASS (78/80)
- `npm run organism:restart`: PASS
- `npm run organism:integrity`: PASS
- `npm run organism:architecture`: PASS
- `npm run operational`: PASS
- `npm run research:p4:migration`: PASS
- `npm run research:p5:migration`: PASS
- `npm run organism:p5:smoke`: PASS
- `npm run p5:release-audit`: PASS
- `npm run typecheck:dev`: PASS

## Research verification
- P4 consciousness lab: PASS, 3-seed matched lesions
- P5 self-authorship lab: PASS, 3-seed matched lesions
- P5 baseline: 6 self-projects, 16 value revisions, 144 identity trajectory samples, authorship signal ≈ 0.572
- P5 lesions separate self-project, agency, value-evolution and identity-trajectory channels

## Runtime verification
- HTTP health: PASS
- HTTP metrics: PASS
- HTTP chat path with missing external LLM: PASS via deterministic local fallback
- process lock blocks a second organism instance: PASS

## Known non-container boundary
Device Gate on physical Android remains pending. Container checks cannot establish real thermal throttling, battery drain, Android process reclamation, Termux permissions, or multi-day KoboldCpp behaviour.

## Scientific boundary
P5 demonstrates functional/causal architecture-level properties. It does not establish subjective experience or metaphysical free will.
