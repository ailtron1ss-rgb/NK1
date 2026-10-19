# V91

- Replaced accidental cross-sequence coupling in preconditioner statistics with explicit sequence-local reset.
- Kept streaming `step()` stateful; training `forward()` now resets only preconditioner statistics.
- Preserved V90 neural parameter layout; no new trainable modules.
- Added `adaptation_reset_count_v91` for measurable boundary behavior.
- Added 5-seed qualification benchmark against frozen V90.
- Added explicit migration handling for obsolete experimental V91 plasticity tensors.
- Removed prior experimental V91 plasticity implementation from current runtime after qualification showed
  it was not a stable improvement.
- Rejected state-aware router and learned output-gate candidates; they remain outside current.
