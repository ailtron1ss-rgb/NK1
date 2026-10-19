# Release B379 — 35.6.29

## Giant upgrade
B379 upgrades Neuro-Kurisu from evidence-gated physical action to an embodied closed-loop reliability system.

### Added
- `EmbodiedRecoveryController`.
- per-action reliability estimates.
- failure streaks and circuit breaker.
- exponential cooldown/backoff.
- probe/degraded/blocked operating modes.
- 192-entry persistent embodied episode ledger.
- sensor-dropout accounting.
- exact restart restoration.
- full `OrganismRuntime` integration.
- B379 causal stress and runtime tests.

### Architectural rule
No second neural policy was introduced. B365 remains canonical neural decision owner.

### State
Application 35.6.29, state schema 133, release B379.
