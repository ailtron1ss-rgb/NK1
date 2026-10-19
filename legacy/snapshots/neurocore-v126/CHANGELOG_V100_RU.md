# V100 changelog

- Added `TemporalCreditConfig` and `TemporalCredit` helper functions.
- Extended the existing parameter-free fast synapse with single/immediate/dual/adaptive eligibility modes.
- Added adaptive short/long trace routing using signal age.
- Added temporal credit state buffers and diagnostics.
- Added 5-seed delayed-association benchmark over held-out delays.
- Kept the mechanism opt-in; default current behavior remains unchanged.
- Added V99 compatibility coverage and bumped checkpoint schema to 13.
- Updated release metadata to frontier 100 / package 1.00.0.
- Kept historical release material outside current root.
