# CHANGELOG V98

- Added `ReplayGradientAlignment` candidate with transient live-batch gradient probe and persistent per-slot signal.
- Added `GradientSubspaceGuard`, a GPM-inspired low-rank gradient protection mechanism.
- Added full-NeuroCore baseline/guard qualification evidence.
- Fixed standalone checkpoint verifier import path and frontier assertion.
- Updated engine version to `v98-continual-stability`.
- Removed stale V93 document from current root.
- Kept new mechanisms opt-in/candidate-only; no unproven behavior promoted.
