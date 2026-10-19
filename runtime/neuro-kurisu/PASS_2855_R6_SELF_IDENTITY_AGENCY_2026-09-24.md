# Neuro-Kurisu 35.26.0 / P2855 — R6 Self / Identity / Agency

Date: 2026-09-24

## Goal

R6 establishes one production self/identity/agency constitutional authority without replacing the existing policy learner, constitutional action membrane, personhood engine, or self-development systems. The authority is a boundary and causal conditioning layer: it protects hard identity invariants, permits bounded plastic development, gates endogenous goal authorship, and blocks unverified self-modification.

## Implemented

### 1. Canonical self/agency authority

Added `src/organism/system/CanonicalSelfAgencyAuthority.ts`.

Responsibilities:
- hard invariant ownership and fingerprint integrity;
- persistent identity continuity / agency diagnostics;
- bounded self/constitutional action contribution;
- endogenous goal-admission boundary;
- plastic identity-change boundary;
- self-modification evidence/holdout/risk/rollback gate;
- evaluation-only action-contribution lesion surface.

### 2. Hard identity core vs plastic development

The protected invariant set is derived from the existing Kurisu organism canon profile rather than invented per cycle. The runtime stores a stable fingerprint and reconstructs the invariant set from the canonical source on restore. A tampered persisted fingerprint produces `invariantIntegrity01=0` and an `identity-block` state; persisted adaptive traits remain plastic and are bounded to `[0,1]`.

The protected assertion is kept distinct from developmental traits: `I am Kurisu Makise.`

### 3. Causal production integration

`OrganismCore` now observes canonical self state each cycle and routes the self/agency action contribution through the policy authority ledger. The previous independent combination of `autonomousPersonhood`, `autonomousSelfImprovement`, and `selfModelDecisionBias` is consolidated through the canonical self/agency surface before final utility. The canonical action-policy arbiter remains the production policy authority; R6 does not create a second value learner.

### 4. Endogenous goal authorship

The canonical goal boundary distinguishes user/external intent from ordinary environmental sensation. This was important: the first live calibration incorrectly treated any external sensory signal as external goal authorship and blocked all internal goals. The production gate was corrected to use `observation.text || observation.externalGoal` as the external author-intent signal.

Live result over 10 cycles:
- goal admission checks: 10
- goal blocks: 4
- internal goal admissions: 6
- the 4 blocked cycles correspond to explicit external/user input in the live harness
- external goals never become `internal` ownership through the canonical gate

### 5. Plastic identity changes

Core identity/name/invariant changes are hard-blocked. Low-impact adaptive traits require valid evidence, continuity and rollback readiness. The live test records a valid evidence item and confirms that an adaptive identity change becomes `proposed` instead of being automatically discarded, while the core-identity request remains `declined`.

P34 evidence validation was tightened so the canonical gate counts only evidence IDs actually present in the P34 evidence store.

### 6. Self-modification boundary

Existing `SandboxedSelfRewriteEngine` / neuro-evolution proposals now pass through a second canonical constitutional gate requiring expected/holdout gain, low risk, identity continuity, valid evidence, rollback readiness and invariant fingerprint match. This pass does not execute self-modifying production code; it gates proposal admission.

### 7. Causal ablation

The authority exposes an evaluation-only lesion surface that does not mutate production state. With a 90% lesion:
- self-agency action contribution is materially reduced;
- invariant integrity and fingerprint remain unchanged.

Live 10-cycle result:
- causal ablation absolute delta: `0.0765`
- invariant integrity after lesion evaluation: `1.0`

The existing 151-cycle unified self-agency gate also remained causal under lesion:
- baseline bias: `0.0210573564`
- lesioned bias: `0.0052643391`
- causal delta: `0.0157930173`

## Verification

### R6 direct / live

`npm run test:self-agency` — PASS

Direct authority:
- invariant integrity: `1.0`
- verify contribution: `0.0489626`
- explore contribution: `0.0287990`
- internal goal: admitted
- external goal: blocked
- core identity change: blocked
- adaptive identity change: allowed at the authority layer with evidence
- self-modification evidence gate: open for the strong synthetic control case
- tampered fingerprint: integrity `0`

Live organism:
- 10 self-agency cycles
- invariant integrity: `1.0`
- agency integrity: `0.5636`
- identity mutation blocks: `2`
- goal checks: `10`
- goal blocks: `4`
- self-modification checks: `10`
- self-modification blocks: `0`
- adaptive identity request with real evidence: `proposed`
- policy contributions: `21`
- duplicate policy source pairs: `0`

### Regression evidence

PASS:
- TypeScript runtime typecheck.
- canonical action policy.
- policy authority ledger.
- P2855 contextual policy: holdout accuracy `1.0`, 1,200 updates, persisted.
- P2855 organism integration: 84 cycles, 84 policy selections, persisted.
- P2855 ablation: `0.2667` policy-on vs `0.1667` policy-off, `+0.10` absolute on the existing controlled benchmark.
- P34 causal personhood and integration.
- R3 unified latent world, ablation and restart.
- R4 temporal credit, ablation, restart, integration and 10,000-iteration bounded performance.
- R5 memory lifecycle, authority regression and retention ablation.
- B291 unified self-agency gate: 151 cycles, 600 learning updates, causal lesion delta `0.01579`.

### Release integrity

- `CLEAN_ARCHITECTURE=PASS sourceFiles=1670 canonicalFiles=533 missing=0 cycles=0 legacyLeakage=0`
- `RELEASE_CONTRACT=PASS`
- `SOURCE_HYGIENE files=3683 errors=0 warnings=0`
- `CLEAN_INTEGRITY=PASS files=3689 release=35.26.0 core=100.19.0-contextual-action-policy-p2855 schema=219`
- `RELEASE_SOURCE=PASS`
- archive manifest: `3929` files; missing `0`; hash mismatches `0`; extra `0`.

## Important negative findings

1. The full P2854 hierarchical slow-memory transfer suite still reaches an external timeout in the current runtime harness. P2854 core integration itself passes. This remains an open performance/scaling target rather than a release claim.

2. The previously observed 80-cycle organism-autonomy timeout remains unresolved. R6 does not claim mobile-readiness or stable long-duration performance.

3. Self-modification remains proposal-gated; no unrestricted self-modifying production code is enabled.

4. This pass does not establish consciousness. Identity, agency, continuity and consciousness remain separate empirical questions.

## Architectural rule established

Hard identity invariants are owned by one canonical constitutional self/agency authority. Developmental traits remain plastic but evidence-gated. Self-authored goals must pass an internal-authorship boundary. Self-modification proposals must pass independent evidence, holdout, risk, identity and rollback gates. None of these mechanisms replaces the canonical action-policy learner or the final constitutional action membrane.

## Next major pass

R7 — performance/mobile and long-horizon stability:
- trace the 80-cycle timeout;
- identify growing O(n) and full-state-copy paths;
- bound semantic graph/replay/trace growth;
- profile heap retention and GC pressure;
- establish stable long-run latency and memory envelopes;
- rerun autonomy after performance lesions;
- preserve all R3-R6 causal evidence while reducing runtime cost.
