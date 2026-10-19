# B620 Release Notes

## Major changes
- Added B561–B620 Meta-Cognitive Evolution layer.
- Added contextual meta-policy and action-conditioned policy.
- Added regime-shift detection and accelerated plasticity.
- Added dual-process memory, provenance and confidence calibration.
- Added action-conditioned world prediction and bounded counterfactuals.
- Added co-evolving skills and bounded transfer.
- Added information-gain experiment selection.
- Added real adaptive compute governor.
- Added 64D distributed population code and local outcome-conditioned plasticity.
- Added identity/goal coherence signals.
- Added multi-lesion, hidden-composition, reversal, restart and performance benchmarks.

## Real fixes discovered during audit
1. Repaired a full-arbitration wiring gap where B421/B451/B501 residuals were not guaranteed to influence raw utility.
2. Extended StateMigrations to persist/restore B561–B620 state correctly.
3. Registered and fixed the B561–B620 performance benchmark script.

## Verification
- Typecheck PASS
- New layer core/integration/wiring/performance PASS
- B382/B383/B384 regression PASS
- Architecture/ownership/hygiene/forensics/full audit PASS
- Release source/integrity/contract/lock PASS
- Server smoke PASS
- Archive manifest regenerated from final tree

## Caveats
- Harder holdout remains 50%.
- Reversal result is synthetic and not an independently isolated adaptation gain.
- Android/Termux physical certification still requires the target device.
