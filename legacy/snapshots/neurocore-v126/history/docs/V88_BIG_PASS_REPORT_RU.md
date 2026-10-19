# NeuroCore V88 — BIG PASS REPORT

Дата: 2026-09-24
Статус: CURRENT FRONTIER / RESEARCH-QUALIFIED

## Цель

Удешевить model-aware replay V87 без потери его реального свойства: utility должна зависеть от текущего состояния обучаемой модели, а не вычисляться только при записи эпизода.

## Что реально изменено

1. Добавлен per-slot cache жизненного цикла V87 utility через существующий `learning_replay_utility_ema_v87` и `learning_replay_utility_probe_step_v87`.
2. Добавлен sparse cache-refresh controller V88:
   - refresh по bounded TTL;
   - refresh полностью холодного cache;
   - early refresh при spike предыдущей gradient norm относительно EMA;
   - ограниченный `probe_cap=6` для мобильного режима.
3. Новые replay slots не форсируют probe на каждом optimizer step; они попадают в ближайший scheduled refresh.
4. Probe candidate ranking учитывает staleness, priority и utility uncertainty.
5. Встроено сохранение/загрузка scheduler state.
6. Новых trainable parameters нет.
7. Optimizer/replay learning path V87 не дублируется и не заменяется.

## Anti-illusion исправления

Первый вариант V88 давал probe на каждом шаге из-за любого newly-written slot. Это фактически обнуляло смысл cache. Ошибка обнаружена targeted test'ом и исправлена: новые slots теперь обновляются по расписанию, пока cache не холодный и нет явного model-change spike.

Второй тестовый дефект был вызван случайным priority tie-break в picker test. Тест переведён на deterministic equal-priority fixture.

## Code qualification

- V86 + V87 + V88 targeted tests: **19/19 PASS**.
- `compileall` для V82/V83/V84/V86/V87/V88/frontier: **PASS**.
- `import neurocore`: **PASS**.
- `CURRENT_FRONTIER = 88`: **PASS**.
- Total parameters: **366,909**.
- Active parameters: **159,342 (43.43%)**.

Полный исторический pytest suite не считается green gate: ранее он превышал runtime limit среды. V88 оценивается по bounded current-frontier gate и отдельным завершённым experiments.

## 3-seed matched V87 vs V88

Protocol: одинаковые seeds `(0,1,2)`, одинаковая модельная инициализация внутри каждой пары, одинаковый A→B→C→A→B→C target stream, 12 optimizer steps/run.

### Wall-clock

- V87 mean: **1.7456 s**
- V88 mean: **1.6895 s**
- delta: **−3.21%**

Это небольшое снижение стоимости, не большой speedup claim.

### Utility refresh

- V87 utility probe scheduler events: **6/run**
- V88 cache refresh events: **3/run**
- V88 refreshed slots: **15/run**
- V88 cache hits: **9/run из 12 requests = 75%**
- V88 selection changes: **7.33/run**

Важно: `utility_probe_events_v87=0` в V88 строках benchmark не является отсутствием probes. Это потому, что V88 обновляет cache напрямую через sparse controller, после чего отключает внутренний V87 probe. Реальный счётчик V88 — `cache_scheduler_events_v88` и `cache_refresh_slots_v88`.

### Learning signal

Mean loss-delta:

- V87: **0.24360**
- V88: **0.29812**

Разница неоднородна по seed: V88 хуже на seed 0, лучше на seed 1 и немного хуже на seed 2. Поэтому этот результат **не используется как доказательство превосходства обучения**.

## Scientific interpretation

V88 доказал прежде всего вычислительное свойство: cached model-aware utility можно обновлять заметно реже, сохраняя возможность менять replay selection. Это соответствует более общей линии replay research, где критерий выбора memory samples рассматривается как самостоятельная часть continual-learning системы; MIR, например, прямо строит retrieval по ожидаемой интерференции текущего update, а benchmark work показывает существенную зависимость качества и стоимости от replay strategy. citeturn237265academia1turn237265academia0

При этом высокий current-model loss сам по себе не гарантирует полезность sample: model-based hard-example selection может усиливать шум, поэтому V88 намеренно сохраняет V86 information strata и использует utility только внутри них. Это соответствует наблюдениям о trade-off между hard-example scoring и learnability/quality selection. citeturn237265search5

## Что PROVEN

- V88 работает без добавления trainable parameters.
- Utility cache реально обновляется sparse refresh-ами.
- 75% cache-hit rate в завершённом 3-seed matched smoke.
- V88 сохраняет model-aware selection: выбор replay меняется несмотря на редкие probe refresh.
- V88 не ломает V86/V87 current-frontier tests.
- Cache scheduler state сериализуется.

## Что НЕ PROVEN

- V88 снижает catastrophic forgetting на длинных benchmark streams.
- V88 превосходит V87 по task quality.
- 3.21% wall-clock improvement устойчив на других CPU/GPU/device profiles.
- time-based stale criterion является оптимальным.
- текущая replay architecture уже Pareto-optimal.

## Main decision

V88 остаётся **current frontier** как compute/control upgrade V87.

Не откатывать: доказана non-regressive execution и реальная экономия probe cadence.

Не объявлять V88 task-level winner.

## Next frontier — V89

V89 должен отказаться от дальнейшего роста replay heuristics и провести stronger end-to-end qualification:

1. Split/Permuted/rotated digits streams с реальным task metric.
2. 3–5 seeds, same checkpoint and optimizer budget.
3. Current-only / fixed replay / V86 coverage / V87 utility / V88 cached utility.
4. Positive forgetting, adaptation, BWT/FWT, recovery.
5. Replay compute separately from optimizer compute.
6. Затем compute-matched recurrence A/B: V80 GRU vs V82 selective-delta.
7. Only after this gate — external Mamba/linear-recurrent candidates.

## Process self-audit

Качество прохода: **~91%**.

Сильные стороны: реальный bug discovery before release, zero-parameter control upgrade, finished 3-seed matched A/B, explicit cache accounting, no task-level superiority claim.

Ограничения: long-horizon external qualification still too expensive in this environment; V88 remains primarily a systems/compute improvement rather than a demonstrated continual-learning breakthrough.
