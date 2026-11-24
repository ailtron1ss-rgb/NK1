# RELEASE NOTES — B263

## Neuro-Kurisu 35.6.1
### B263 Real Action Consequence & Behavioural Causality

Добавлен причинный слой реальных action→consequence transitions.

### Основные изменения

- `B263RealActionCausality`.
- action-conditioned latent-delta learning.
- shuffled-action negative control.
- `do(action)` intervention API.
- action comparison.
- causal holdout.
- replay.
- action ablation.
- causal diagnostics.
- OrganismCore integration.
- StateMigrations integration.
- restart preservation.
- evidence artifacts.

### Проверка

B259/B260/B261/B262 regression — PASS.
B263 standalone — PASS.
B263 Core integration — PASS.
Architecture/integrity/hygiene/contract/forensics/release-source/manifest/archive — PASS.
Full historical syntax sweep — BLOCKED_BY_ENV.
