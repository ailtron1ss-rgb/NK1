# WorkPass322 — signed P26 evidence and verified source candidate

**Date:** 2026-10-26  
**Branch:** `fix/runtime-typecheck-dependency-contracts-2026-10-25`  
**Last fully validated code commit:** `c1d3b149dd8022af39d5b52d829f030526bf9849`  
**Prior full validation:** [Actions run 40251315322](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40251315322) — success.

## Signed independent-evidence boundary

- Implemented `P26TrustedHoldoutEvidenceAuthority.ts`: loads a bounded JSON allowlist of verifier IDs, Ed25519 **public** keys and allowed evaluation protocols from `NEURO_P26_HOLDOUT_VERIFIERS_JSON`.
- Signature bytes are checked canonically over schema version, evidence identity, task/protocol/verifier identity, sample-set hash, baseline/learned scores and the claimed verified/independent state. A changed score or protocol is rejected.
- `DevelopmentalNeuralRuntime` passes the configured verifier into its P26 engine. The Core-owned `p26VerifiedHoldoutRecord` wrapper persists accepted evidence, and the authenticated runtime endpoint `POST /api/organism/true-learning/holdout-evidence` records it using the same canonical state owner.
- Restore re-verifies every holdout signature; persisted flags or forged snapshot rows do not confer trusted evidence. Evidence without configured verifier keys is rejected and does not raise `generalizationEvidence01`.
- Added unit regression for signature tampering, protocol allowlist, non-independent rejection, duplicate evidence, corrupted restore and malformed config. Server smoke generates an ephemeral Ed25519 key pair and verifies the real HTTP path accepts the valid signed record, rejects a changed score and rejects replay.

The signing private key must remain only in the independent evaluator. The verifier public key is configured per deployment; this repository does **not** ship a built-in external evaluator service or a trusted private key.

## Source candidate packaging

The validation workflow now runs source/asset release audits after the Compose smoke, packages a ZIP from the exact verified Git commit, checks unsafe archive paths and secret/private-key material, computes SHA-256 and uploads a 14-day GitHub Actions artifact. The report inside the artifact states the exact commit and run URL. This is a review candidate, not an official release publication.

## Verified status and limits

- Code commit `c1d3b149dd8022af39d5b52d829f030526bf9849` passed [run 40251315322](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40251315322): both TS checks, frontend production build, cognitive/motivation, P26 signed verifier + integrity/recovery/continual matrix, gateway and route regressions, server/security/restart smoke, and three-service Compose boot with same-origin UI → runtime architecture validation.
- The packaging workflow and report edits are new and must pass their own exact-HEAD CI before the artifact can be considered validated.
- P26 training metrics shown by unit/benchmark tests remain synthetic regression measurements, not independent real-world learning uplift.
- `main` remains untouched; PR #129 remains draft. Official GitHub Release still contains `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`; no release asset has been overwritten or published from this branch.
- External LLM configuration, voice/Live2D/camera E2E, target-device soak, live external evaluator deployment and licensing review remain release gates.
