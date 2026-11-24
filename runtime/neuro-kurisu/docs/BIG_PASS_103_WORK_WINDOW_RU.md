# BIG PASS 103 — рабочее окно

## Полный чек-лист

### Сделано
- [x] Исправлено смешение replay с retrieval через `lastReplayedAt`.
- [x] Добавлен bounded replay event ledger.
- [x] Добавлена независимая replay validation.
- [x] Добавлен matched replay ON/OFF experiment harness.
- [x] Добавлена goal-conditioned выборка.
- [x] Replay connected to causal experience.
- [x] Replay connected to unified learning.
- [x] Provenance separation для runtime/replay/repair/external.
- [x] `stateGrounded` отделяет фактический state transition от synthetic signal.
- [x] Holdout-gated transfer probes.
- [x] Negative transfer/interference tracking.
- [x] Миграция schema 112.
- [x] Regression tests 101/102/103.
- [x] Mobile bounds для новых журналов.
- [x] Release manifests regenerated.
- [x] Operational 500 + mobile 1000 regression checked.

### Не завершено в этом проходе
- [ ] Реальный длительный набор независимых задач для replay-on/off.
- [ ] Настоящая измеренная forgetting curve на накопленных данных организма.
- [ ] Полный operational horizon 1000: текущий прогон превысил execution-time limit, поэтому статус остаётся NOT CONFIRMED.
- [ ] Доказанный causal effect replay на skill performance в production workload.
- [ ] Тесная связь replay с procedural skill variants.
- [ ] Sleep-like scheduler с доказанной пользой, а не только периодическим tick.
- [ ] Любое утверждение о phenomenology/consciousness.

## Почему оставлено на следующий проход
Сделать API без накопления независимых данных легко; объявлять эти APIs доказательством эффективности было бы самообманом. Следующий проход должен тратить ресурс на measurement harness и реальные repeated holdout trials, а не на ещё один слой абстракций.
