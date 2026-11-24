# B281 Release Notes — Predictive Inter-Area Messaging

B281 upgrades B280 from explicit cross-area communication to delayed predictive communication.

### Added
- predictive inter-area messages;
- next-step target evaluation;
- edge-specific encoder/predictor/context weights;
- delayed credit;
- hidden temporal transfer benchmark;
- edge lesion test;
- Core persistence and migration;
- architecture/progress/audit/evidence documents;
- reproducible release script.

### Important correction
The same-step prediction/target shortcut was removed. Predictions are now evaluated against the following observed area state.

### Validation
Standalone, hidden-transfer, Core and migration tests pass. Repository-wide full executable syntax gate is blocked by the current environment execution window and is not represented as a PASS.
