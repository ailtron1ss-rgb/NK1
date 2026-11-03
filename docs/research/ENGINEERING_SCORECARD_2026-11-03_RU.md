# NK1 — provisional engineering scorecard

Date: 2026-11-03  
Baseline: `workpass70-source` @ `36e576da622c0eb3d55759bb086657048c0243c1`

> These percentages are provisional engineering-maturity estimates, not measured intelligence, not proof of consciousness, and not release certification. They are deliberately conservative and are not derived from code volume or number of modules. Current open work on PRs #716–#718, #721, #746, #753 and #756 is tracked separately and is not counted as merged baseline capability. PR #720 has been merged into workpass70-source; PR #723 is merged only into the parent Engineering OS branch.

## Scorecard

| Area | Maturity | Evidence already present | Main gap before increasing score |
|---|---:|---|---|
| Core cognitive cycle / planning | 60% | Unified cognitive cycle, planner, causal event fabric, exact-head CI gates | Long-horizon behavioural reliability, integrated end-to-end causal traces and mobile soak |
| Memory / learning | 45% | MemoryOS2 is canonical; frame-aware spatial grid, derived-index map consistency diagnostics, 10k index stress and diversified five-seed holdout contracts are now in source; earlier controlled holdout showed recall@10 0.00→1.00, index microbenchmark p95 1.195 ms | Rerun current diversified holdout on 36e576…, real P41/world-calibrated holdout, full MemoryOS2 p95 at 10k entries, transfer and no-regression evidence |
| Motivation / autonomy / agency | 40% | Intrinsic drives, endogenous goal lifecycle, action gateway and self-agency gates | Background initiative usefulness, restart/pause behaviour and long-duration independent soak |
| Self-model / personality continuity | 45% | SelfModelV2, personality coupling, identity continuity and self-agency evidence | Longitudinal trait stability, calibrated self-beliefs and adversarial identity-continuity evaluation |
| Affect / interoception / attention | 40% | Emotion appraisal, interoceptive estimator, brainstem arousal/sleep scheduler, predictive attention; PR #720 safe allocator is merged, PR #756 estimator own-data/Proxy hardening passed 11/11 tests and exact-head runtime typecheck | Causal attention-to-action wiring, paired adaptive-vs-fixed behaviour evidence, calibrated sensor coverage and real-device soak |
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

- PR #716 — Engineering OS control plane; parent head 8fa7bf8023ed… with 10 exact-head workflows green; still an open draft against an older source base.
- PR #717 — hostile-input manifest validation; child branch on the Engineering OS parent; rebase/stack reconciliation and independent review remain.
- PR #718 — coordinator lock reclamation guard; child branch on the Engineering OS parent; concurrent lease/restart stress and review remain.
- PR #719 — EmotionAppraisalEngine restore hardening; closed without merge; keep as historical work unless a distinct gap remains.
- PR #720 — interoceptive precision allocator; merged into workpass70-source by commit 36e576da622c…; safe own-data input, accessor non-execution and hostile Proxy fail-closed contracts are now baseline.
- PR #721 — donor-source provenance and archive inventory; open research/documentation draft, not runtime capability.
- PR #722 — earlier read-set child; superseded by fresh parent-based PR #753.
- PR #723 — patch diff provenance and policy preflight; merged into the parent Engineering OS branch only, not workpass70-source.
- PR #746 — grounded P41→MemoryOS2 spatial bridge; exact head c588f54a361e…; focused Core tick, bridge and runtime typecheck plus 25 unique broader workflows green; open draft and based one source commit behind.
- PR #753 — read-set patch admission; exact head f019606e15b2…; 11/11 admission tests, full Engineering OS suite, CLI and symlink-containment smoke all green; open draft stacked on the parent Engineering OS branch.
- PR #756 — InteroceptiveStateEstimator input hardening; exact head 7d7a4c6895af…; 11/11 tests, runtime typecheck, allocator/estimator focused workflows, Unified Runtime, WorkPass79 and NeuroCore checks green; open draft against current source base.

Spatial MemoryOS2 implementation, its 10k index stress contract and five-seed holdout test are already in the current source baseline. They are not counted as new unmerged capability. Their synthetic holdout numbers must remain labelled as controlled-fixture evidence, not real-world spatial accuracy.
