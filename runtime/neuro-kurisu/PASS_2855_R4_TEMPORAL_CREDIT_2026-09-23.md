# PASS 2855 R4 — Canonical Temporal Credit Authority

Date: 2026-09-23
Release line: 35.26.0 / P2855
Purpose: implement a single production temporal-credit authority without introducing a second action-value/policy learner.

## Goal

Close the causal learning loop for delayed consequences:

`decision(t) -> action -> later outcome -> temporal credit assignment -> original context/action learner`

The temporal layer is deliberately separated from policy learning. `AdaptivePolicyEngine` remains the canonical action-value/policy learner; R4 owns only delayed attribution, eligibility and bounded n-step-style return construction.

## Production implementation

### New canonical module

`src/organism/learning/CanonicalTemporalCreditAuthority.ts`

Responsibilities:

- register the exact decision id, tick, action, context key and predicted value;
- retain bounded pending decisions (64), outcomes (128) and assignments (128);
- calculate bounded delayed eligibility using `lambda=0.82`;
- calculate discounted return using `gamma=0.88` and a maximum horizon of 8 ticks;
- calculate signed TD-like error against the original prediction;
- produce a delayed credited reward tied to the original decision context;
- attach evidence/independence/autonomy confidence without fabricating verification;
- persist and restore all temporal state;
- expose diagnostics and lesion controls.

No new policy head was added.

## Core integration

`OrganismCore` now:

1. registers every selected production decision with the temporal authority;
2. persists the pending temporal state alongside the normal organism state;
3. resolves temporal assignments during feedback using the exact historical `decisionId`;
4. sends only `delayTicks > 0` assignments into `AdaptivePolicyEngine.observeVerifiedOutcome(...)`;
5. keeps the existing immediate `adaptivePolicy.update(...)` path for the current decision, avoiding double immediate credit;
6. exposes `canonicalTemporalCreditDiagnostics()`.

This produces a single production learning path for delayed credit while preserving the existing canonical policy authority established in R1/R2.

## Tests and evidence

### Temporal contract

`R4_TEMPORAL_CREDIT_AUTHORITY_PASS`

Three decisions at ticks 1/2/3 received one outcome at tick 4. Eligibility decreased with delay:

- delay 3: eligibility 0.5514
- delay 2: eligibility 0.6724
- delay 1: eligibility 0.8200

All three retained their original, distinct context keys and received bounded causal confidence.

### Ablation

`R4_TEMPORAL_CREDIT_ABLATION_PASS`

Normal lambda=0.82 vs temporal lesion lambda=0:

- older-decision eligibility: 0.55137 -> 0
- older-decision credited reward: 0.38990 -> 0.25000
- absolute credit delta: 0.13990

This is evidence that the temporal route changes delayed assignment behavior; it is not a claim of increased intelligence or consciousness.

### Persistence / restart

`R4_TEMPORAL_CREDIT_RESTART_PASS`

Pending decisions survived snapshot/restore and were later resolved while retaining their original context/action identities.

### Full Core integration

`R4_TEMPORAL_CREDIT_INTEGRATION_PASS`

Observed two production decisions, delayed one outcome, and verified:

- 2 decisions registered;
- 2 resolved;
- 1 delayed assignment;
- 0 open decisions after feedback;
- delayed assignment entered the original `AdaptivePolicyEngine` context/action;
- its policy row gained `verifiedUpdates=1`.

### Bounded performance

`R4_TEMPORAL_CREDIT_PERFORMANCE_PASS`

10,000 synthetic register/resolve iterations:

- 10,063 assignments;
- ~119 ms in the final run;
- pending queue remained bounded at 64;
- assignment history remained bounded at 128;
- serialized authority state ~72.9 KB.

This benchmark measures the isolated authority, not whole-organism runtime latency.

## Regression checks

Passed after R4:

- typecheck;
- R3 unified latent world tests;
- R3 latent ablation;
- R3 restart;
- canonical policy arbiter;
- live canonical policy path — P2855 contributed to 7/7 actions;
- P2855 policy ablation;
- clean organism smoke;
- restart persistence;
- B2521 runtime;
- architecture audit;
- release contract audit;
- source hygiene;
- release-source verification.

Latest architecture result:

`CLEAN_ARCHITECTURE=PASS sourceFiles=1664 canonicalFiles=531 missing=0 cycles=0 legacyLeakage=0`

Latest hygiene result:

`SOURCE_HYGIENE files=3675 errors=0 warnings=0`

## Important remaining limitation

The long-horizon whole-organism autonomy test is still not considered passed. Earlier measurements showed cycle latency and heap usage rising across tens of cycles and the 80-cycle test timing out. R4 intentionally did not hide or redefine that result.

R4 adds bounded temporal state and does not remove the need for R7 mobile/long-run profiling.

## Architecture effect

Before R4, temporal credit was distributed across multiple partial mechanisms. After R4, delayed action-policy credit has a single explicit production attribution authority:

`Organism decision trace -> CanonicalTemporalCreditAuthority -> AdaptivePolicyEngine -> CanonicalActionPolicyArbiter`

Other replay/credit mechanisms remain specialized subsystems and are not promoted into a competing action-value authority by this pass.

## Next target

R5 — Unified Memory Lifecycle:

`encode -> retain -> retrieve -> reconsolidate -> replay -> consolidate -> decay/quarantine -> identity-relevant persistence`

The next pass should reduce competing memory authorities, create one production lifecycle contract, enforce bounded memory pressure for phone operation, and add independent retention/transfer/negative-transfer ablations.
