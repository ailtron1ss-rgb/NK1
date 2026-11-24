# Neuro Kurisu 35.6.76 — P2675

P2675 adds active information-gain action selection and a persistent closed-loop evidence ledger.

The major architectural change is that external evidence can now change not only confidence but also *which next action is worth performing as an experiment*. The observed consequence is then stored as a structured evidence episode and fed into causal, memory, skill and developmental learning.

See:
- `PROJECT_PROGRESS_35.6.76_P2675_RU.md`
- `FINAL_AUDIT_35.6.76_P2675_RU.md`
- `docs/research/2026-09-18/P2675/P2675_ACTIVE_INFORMATION_RESEARCH_RU.md`
- `docs/history/p-phases/2026-09-18/P2675/RELEASE_NOTES_RU.md`
