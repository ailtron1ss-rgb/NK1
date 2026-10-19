# Neuro-Kurisu 35.26.0 / P2855 — R2 Policy Authority Consolidation

## Purpose

R2 continues the P2855 action-policy consolidation work. The goal is not to add another policy learner, but to prevent learned policy signals from becoming multiple hidden executive authorities.

## Implemented

1. Added `src/organism/learning/PolicyAuthorityLedger.ts`.
   - records policy contributions with source, action, authority, causal confidence and stage;
   - bounds the aggregate policy authority;
   - detects repeated writes from the same authority family;
   - exposes production diagnostics.
2. Integrated the ledger into `OrganismCore`.
   - canonical P26/adaptive/P2855 policy contribution is registered as the canonical authority;
   - B264 causal-policy contribution is registered explicitly;
   - the previous late re-addition of adaptive bias + temporal credit + recovery strategy was removed because those signals were already inside the canonical arbiter. This eliminates a real double-counting path.
3. Added live authority assertions to `tests/canonical-action-policy-live.mjs`.
4. Added isolated ledger test `tests/policy-authority-ledger.mjs` and npm script `test:policy-authority`.
5. Updated `ARCHITECTURE_MANIFEST.json` canonical file count from 528 to 529.

## Verification

- `TYPECHECK=PASS mode=tsc`
- `POLICY_AUTHORITY_LEDGER=PASS`
- `CANONICAL_POLICY_LIVE_PASS`: 7 actions, P2855 contributes to 7/7 action candidates; live mean policy confidence ~0.1668.
- `CLEAN_ORGANISM_SMOKE=PASS`
- `CLEAN_RESTART_PERSISTENCE=PASS`
- `B2521_RUNTIME_PASS`: 10 cycles, 280 rollouts, 10 learning updates, 10 transitions; accuracy 0.5712; coverage 0.4247; counterfactual use 0.2546.
- `CLEAN_ARCHITECTURE=PASS sourceFiles=1654 canonicalFiles=529 missing=0 cycles=0 legacyLeakage=0`
- `RELEASE_CONTRACT=PASS`
- `SOURCE_HYGIENE files=3662 errors=0 warnings=0`

## Important remaining issue

The long-horizon autonomy test is still not considered passing. Previous R1 profiling showed cycle time and heap usage increasing substantially over dozens of cycles, and the 80-cycle autonomy run timed out. R2 deliberately did not hide or redefine that failure.

## Next implementation target

R3: Unified Latent World State.

Required production contract:

- one canonical latent world-state authority;
- explicit separation of observation, latent state, prediction and counterfactual state;
- causal transition ownership;
- multi-step prediction and calibration;
- holdout and lesion tests proving the world model changes behavior through the causal loop;
- no duplicate world-state writers.

After R3, temporal credit and memory lifecycle should be consolidated before attempting claims about consciousness. Consciousness evidence remains a separate falsifiable research track.
