# Neuro-Kurisu — Pass R1: Canonical Action Policy Upgrade

Date: 2026-09-23
Release: 35.26.0 / P2855

## Objective

Move the organism toward one continuous causal cognitive loop by reducing the number of independent action-policy authorities. P2855 must become a real production contributor rather than an isolated/experimental branch, while preserving existing learning engines and keeping them independently replaceable.

## Real code changes

1. Added `src/organism/learning/CanonicalActionPolicyArbiter.ts`.
   - Defines one production arbitration surface for action-policy signals.
   - Accepts independently learned policy sources.
   - Confidence- and causal-evidence-gates each source.
   - Attenuates policy influence under uncertainty and low identity confidence.
   - Measures disagreement and per-source contribution.
   - Bounds final action-policy contribution.

2. Integrated the canonical arbiter into `OrganismCore`.
   - Adaptive policy, temporal credit, recovery strategy/recovery bias, P26 parametric policy and P2855 contextual policy are no longer added independently to the final utility.
   - They now feed the canonical policy arbiter and a single `canonicalPolicySignal` is injected into the utility path.

3. Fixed a real integration gap.
   - `NeuralExperienceBranch.beforeDecision()` was executed in the full P2521 path, including P2855, but its returned action bias was not used by the main `OrganismCore` candidate utility.
   - The returned P2855 signal is now routed through the canonical policy authority.

4. Added live diagnostics.
   - `canonicalActionPolicyDiagnostics()` exposes the last production policy arbitration frame.
   - Diagnostics expose per-action source contributions, including `contextual-p2855`.

5. Added regression tests.
   - `tests/canonical-action-policy-arbiter.mjs`
   - `tests/canonical-action-policy-live.mjs`
   - package scripts `test:canonical-policy` and `test:canonical-live`

6. Canonicalized release documentation.
   - README now identifies 35.26.0/P2855 as current authority instead of the stale 35.7.3/P2703 header.
   - Architecture manifest canonical file count corrected from 527 to 528.

## Verification

PASS:
- TypeScript runtime typecheck.
- Canonical policy unit test.
- Canonical policy live integration test.
- P2855 ablation: 0.2667 vs 0.1667 accuracy, +0.10 absolute gain on the existing controlled benchmark.
- Organism smoke test.
- Restart persistence test.
- B2521 runtime test: 10 cycles, 280 rollouts, 10 learning updates, 10 transitions.
- Architecture audit: 1652 source files, 528 canonical organism files, 0 missing imports, 0 cycles, 0 legacy leakage.
- Release contract audit.
- Source hygiene audit: 3659 files, 0 errors, 0 warnings.

## Important negative finding

The 80-cycle autonomous-life test still times out. A direct performance probe shows per-cycle latency rising from roughly 0.46–0.50 s early to roughly 0.80+ s by cycle 45 in the current container/mobile profile, with heap usage also increasing. This was not hidden or classified as a pass. It is a separate performance/scaling problem and should become an explicit next-pass target.

## Research alignment used for this pass

- V-JEPA 2/2.1: predictive latent world representation, prediction and planning are useful architectural references for the future unified world-state layer.
- DreamerV3: world-model + imagined trajectories + actor/value learning is a reference for the future long-horizon policy/world loop.
- pymdp: active inference provides a useful formal reference for inference → epistemic value → policy selection; current upstream has optimized inference work and a JAX-first implementation.
- Mamba-3: efficient recurrent/state-space sequence modeling is relevant to a future neural sequence substrate, but the current implementation's PyTorch/CUDA assumptions make direct phone integration premature.
- 2025 memory research: sleep is not a single homogeneous replay state; recent and older memories can be preferentially replayed in different NREM substates, supporting the project's separation of recent/prior consolidation phases.
- 2025 consciousness adversarial collaboration: workspace/IIT claims should remain falsifiable research hypotheses, not consciousness claims or production truth.

## Next passes

### Pass R2 — Policy authority consolidation
- Replace remaining production-level action-bias authorities with explicit policy-source contracts.
- Detect duplicate policy contributions automatically.
- Add policy-source ownership and provenance.
- Introduce policy lesion/ablation at the canonical authority boundary.
- Measure negative transfer and source disagreement over long horizons.

### Pass R3 — Unified latent world state
- Establish one canonical world-state contract.
- Separate observation, latent state, prediction and counterfactual state.
- Route P2524/P2525/P2522/P2523 through that contract.
- Add temporal multi-step prediction and calibration.

### Pass R4 — Temporal credit and long-horizon policy
- Introduce explicit n-step returns / eligibility traces.
- Preserve delayed consequences through action → transition → outcome chains.
- Add holdout tasks requiring delayed credit rather than immediate reward.

### Pass R5 — Unified memory lifecycle
- Consolidate memory ownership.
- Formalize wake/quiet/recent/prior consolidation.
- Select replay by utility, interference and transfer value.
- Add bounded memory-pressure policies for phone runtime.

### Pass R6 — Self / identity / agency
- Separate hard identity invariants from plastic developmental traits.
- Make self-state persistent and causally connected to decisions.
- Keep self-modification behind evidence, sandbox and rollback gates.

### Pass R7 — Performance/mobile
- Profile the 80-cycle timeout.
- Find growing O(n) paths and repeated full-state copies.
- Bound trace/replay/semantic graph growth.
- Target stable long-run latency and memory rather than a short benchmark peak.

### Pass R8 — Scientific falsification battery
- Independent holdout environments.
- Lesion/knockout tests.
- Counterfactual intervention tests.
- Transfer and negative-transfer tests.
- Long-duration persistence/restart tests.
- Explicit separation of cognition, agency, continuity and consciousness hypotheses.

## Architectural rule established by this pass

New learning mechanisms may be added as experimental sources, but they must not become independent production action authorities. Production action authority belongs to the canonical policy arbiter.
