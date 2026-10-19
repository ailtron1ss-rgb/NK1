# P30 — Матрица дефицитов

| Область | Состояние | Что отсутствует | Приоритет |
|---|---|---|---|
| Continual learning | рабочий механизм | длинный held-out benchmark | критический |
| Catastrophic forgetting | ledger есть | multi-task sequential benchmark | критический |
| Rollback | persistable bundle | delta-level rollback + signed checkpoints | высокий |
| World model | 1→6 step predictor | learned latent dynamics with uncertainty | критический |
| Counterfactual | model-based | executable isolated simulator | высокий |
| Vision | compact features | semantic object/scene/event encoder | критический |
| Audio | local features | semantic audio event model | высокий |
| Multimodal | shared latent | learned temporal cross-modal fusion | критический |
| Experimentation | proposals | safe automated execution + analysis loop | высокий |
| Provenance | learning graph | unified memory/identity/value provenance | высокий |
| Memory | multi-timescale | thermodynamic compaction policy in production | средний |
| Identity | anchors/trajectory | evidence-backed revision graph | высокий |
| Phone | resource-aware | 168h/30d physical POCO gate | критический |
| Security | quarantine | tool authority sandbox + poisoned-memory recovery | критический |
| Reproducibility | regression suite | multi-seed deterministic campaigns | высокий |
| Core architecture | large orchestrator | hot-path/slow-path split | высокий |
