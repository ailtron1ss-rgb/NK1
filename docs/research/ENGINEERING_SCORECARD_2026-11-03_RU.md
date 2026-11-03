# NK1 — provisional engineering scorecard

Date: 2026-11-03  
Baseline: `workpass70-source` @ `eaf653d2229b8c032fe542ffb3215ff25ba69a93`

> These percentages are provisional engineering-maturity estimates, not measured intelligence, not proof of consciousness, and not release certification. They are deliberately conservative and are not derived from code volume or number of modules. Current work on PRs #716–#723 and #730 is tracked separately and is not counted as merged baseline capability. PR #723 is merged only into the parent Engineering OS branch, not into workpass70-source.

## Scorecard

| Area | Maturity | Evidence already present | Main gap before increasing score |
|---|---:|---|---|
| Core cognitive cycle / planning | 60% | Unified cognitive cycle, planner, causal event fabric, exact-head CI gates | Long-horizon behavioural reliability, integrated end-to-end causal traces and mobile soak |
| Memory / learning | 45% | MemoryOS2, episodic/semantic retrieval, revision lineage, holdout-pairing and restore integrity | Positive recall uplift on independent multi-seed holdouts; measured latency at 10k entries |
| Motivation / autonomy / agency | 40% | Intrinsic drives, endogenous goal lifecycle, action gateway and self-agency gates | Background initiative usefulness, restart/pause behaviour and long-duration independent soak |
| Self-model / personality continuity | 45% | SelfModelV2, personality coupling, identity continuity and self-agency evidence | Longitudinal trait stability, calibrated self-beliefs and adversarial identity-continuity evaluation |
| Affect / interoception / attention | 40% | Emotion appraisal, interoceptive estimator, brainstem arousal/sleep scheduler, predictive attention | Causal attention-to-action wiring and independent paired evidence that precision allocation improves behaviour; PR #720 implementation and exact-head CI are green, but its paired behavioural gate is still open |
| Embodiment / voice / avatar | 60% | Existing 2D/Live2D path, speech timeline, voice/interrupt infrastructure and fallback contracts | Browser E2E, Android audio/avatar sync, lip-sync drift and promoted 3D asset |
| Evaluation / safety / reliability | 45% | Many focused workflows, restore/lineage tests, holdout eligibility and action governance | Independent multi-seed confirmation, real-device fault injection and complete threat-model review |
| Release / operations | 25% | Published Release exists with GitHub asset digest and a source/release separation rule | Actual ZIP content/digest verification, license sign-off, clean-machine install/build and Android soak |

### Weighted functional engineering maturity

Weights are fixed for this scorecard so later revisions remain comparable:

| Area | Weight |
|---|---:|
| Core cognitive cycle / planning | 20% |
| Memory / learning | 20% |
| Motivation / autonomy / agency | 15% |
| Self-model / personality continuity | 10% |
| Affect / interoception / attention | 10% |
| Embodiment / voice / avatar | 10% |
| Evaluation / safety / reliability | 10% |
| Release / operations | 5% |

**Current provisional weighted maturity: 46%.**

This is a weighted estimate of engineering maturity across the whole system, not a probability that the system is conscious and not a claim that 46% of a human brain has been reproduced.

**Release readiness remains separately estimated at 25%.** It is lower because published-artifact verification, license sign-off, clean-machine reproducibility and real Android/browser qualification are still open gates.

## Rules for score changes

1. A code addition alone does not raise a score.
2. A module raises *implementation* maturity only after its contract and tests exist.
3. It raises *integration* maturity only after the canonical runtime calls it and end-to-end traces prove the connection.
4. It raises *validation* maturity only after exact-head CI plus relevant independent holdout/soak evidence.
5. It raises *release* maturity only after the exact published ZIP contains the change and its digest is independently verified.
6. A failed or regressed gate can lower a score; no monotonic-progress assumption.
7. No area reaches 90% without independent holdouts and real target-device evidence. No release is declared ready while critical licensing or artifact-parity gates remain open.

## Next score-changing gates

- **Memory:** at least five paired seeds, complete non-ambiguous holdout pairs, positive recall delta, no forgetting regression, and p95 retrieval under the target latency.
- **Autonomy:** background initiative measured over a real soak, with usefulness, false-positive, safety-intervention and resource-cost metrics.
- **Interoception:** paired baseline vs precision allocation, same task seeds and resource budget, measuring prediction calibration, recovery success, action quality and compute cost.
- **Embodiment:** real browser and Android runs with voice interruption, audio timing, lip-sync and restart/reconnect checks.
- **Release:** exact ZIP download, SHA-256 recomputation, archive inventory comparison, license/SBOM review and clean-machine install/build.

## Open work not counted in baseline score

- PR #716 — Engineering OS control plane; current parent head 8fa7bf8023ed… with 10 exact-head workflows green, not merged into workpass70-source.
- PR #717 — hostile-input manifest validation; exact-head Engineering OS CI green, stacked child PR.
- PR #718 — coordinator lock reclamation guard; exact-head Engineering OS CI green, stacked child PR.
- PR #719 — EmotionAppraisalEngine restore hardening; 8 exact-head workflows green, not merged.
- PR #720 — interoceptive precision allocation; 15 visible exact-head workflows green, paired behavioural evidence still pending.
- PR #721 — donor-source provenance and archive inventory; documentation-only PR, not merged.
- PR #722 — hash-bound read-set freshness; dedicated contract and parent OS workflows green, not yet wired into mandatory patch admission.
- PR #723 — patch diff provenance and policy preflight; merged into the parent Engineering OS branch only.
- PR #730 — frame-aware spatial recall; focused spatial regressions and runtime typecheck green, broader exact-head workflows partly still running.
