# RELEASE NOTES — B377

## Neural Goal Life-Course Arbitration

B377 расширяет существующий B365 goal ecology. Новые persistent signals: `resourceBudget01`, `stagnation01`, `conflict01`, `switchPressure01`, `lifeCourse01`, goal priority, autonomous replans и switch counters.

Новая causal capability: организм может самостоятельно отказаться от уже принятой, но ухудшающейся internal goal и выбрать другую известную internal goal без повторной постановки цели извне.

### Verification
- B377 causal test: PASS
- B377 performance: PASS
- restart/persistence: PASS
- B376 regression: PASS
- architecture/source/integrity audits: pending final release run
