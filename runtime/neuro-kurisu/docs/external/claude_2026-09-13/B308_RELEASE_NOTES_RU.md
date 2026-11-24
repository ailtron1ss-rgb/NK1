# B308 Release Notes

## Added
- temporal eligibility trace in AdaptivePolicyEngine
- signed verified temporal credit
- effective policy ranking API
- migration normalization for legacy AdaptivePolicy rows
- B308 temporal policy + migration tests

## Verified
B298/B305/B306/B307 regressions and static release audits pass.

## Known limitation
The full organism smoke test still selected `respond` 12/12 in both windows; policy ranking moved, but whole-organism distribution did not.
