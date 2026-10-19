# Neuro-Kurisu 34.9.0 — BIG PASS 40

Дата: 2026-09-05
State schema: 87
Фаза: `Stage-2/cognitive-spine-predictive-project-learning`

## 1. Цель

Цель прохода — не увеличивать количество P-модулей, а усилить единый причинно-обучающий контур:

`prediction → evidence → decision → project → skill → learning`

с сохранением пригодности для среднего Android-телефона.

## 2. Полная сверка с самым первым аудитом

Первичный аудит содержал 20 крупных направлений. При строгой классификации текущего состояния:

- полностью закрыты: 7/20;
- частично закрыты: 12/20;
- не закрыты: 1/20.

Если считать частичный пункт как 0.65 выполненного объёма, общий weighted progress по исходному 20-пунктному плану составляет `74%`.

Это исправляет более оптимистичные оценки прошлых проходов. Важное правило: этот процент отражает реализацию рекомендаций, а не «процент сознания».

## 3. Крупное новое исправление

Обнаружен и исправлен реальный lifecycle-дефект: при пропущенном `project`-cycle `OrganismCore` сбрасывал `AutonomousProjectExecutor` в default-state. Это уничтожало накопленные project steps и могло обнулять прогресс автономного проекта.

Теперь при наличии активного проекта state executor сохраняется между cadence-skips и пересоздаётся только при смене project или отсутствии executor state.

Это является фактическим повышением автономной устойчивости.

## 4. Prediction/Model competition

### P30 добавлен в реальную конкуренцию

В candidate generation теперь участвует лёгкий reward proxy от P30. Он проходит через ModelOlympics calibration и добавляет bounded signal.

### Ensemble

ModelOlympics получил `ensemble()` с empirical reliability weighting. Текущий ensemble объединяет P10/P26/P27/P30.

### Feedback

В feedback-loop P30 теперь тоже получает scoreRound, поэтому его качество влияет на последующие predictions.

## 5. Multi-horizon self prediction

SelfPredictionBenchmark теперь получает prospective samples на горизонтах:

- 1 tick;
- 4 ticks;
- 12 ticks.

Это не заменяет long-horizon world forecasting: это отдельная проверка предсказания собственного будущего поведения.

## 6. Long-horizon benchmark correction

В P45/P54-style long-horizon layer устранена методологическая проблема, когда improvement сравнивался с текущим сглаженным error, а не со стабильным baseline.

Добавлен `baselineErrorByHorizon` и состояние повышено до version 2.

Теперь improvement может означать только улучшение относительно фиксированного baseline horizon.

## 7. Evidence independence

ExternalEvidenceTrust получил явный `independenceCount(claimKey)`.

Теперь независимость рассчитывается по отдельным `independenceKey`, а не только по числу повторов или source class.

`scoreClaim()` учитывает:

- максимальный trust;
- независимость;
- corroboration.

Это уменьшает риск ложной «независимой проверки» одного и того же источника.

## 8. Mobile / phone implications

Изменения не требуют постоянного запуска тяжёлой модели.

P30 и ModelOlympics остаются лёгкими; более дорогие операции по-прежнему контролируются Cognitive Spine cadence.

Это соответствует основной мобильной стратегии:

`many cheap cognition operations + occasional expensive reasoning`.

## 9. Проверки

PASS:

- TYPECHECK
- BIG_PASS_40_SPINE
- BIG_PASS_39 suite
- P67 project evidence
- P64/P65 integration
- P74/P77 integration
- restart persistence
- memory dedup
- operational hardening
- architecture
- forensics
- hygiene
- source truth
- release source
- archive manifest
- P80–P82 E2E (в 30-секундном окне)

Новое интеграционное подтверждение BIG_PASS_40:

`projectCompleted=1`
`projectNext=repeat`
`independentEvidence=2`
`horizonVersion=2`
`ensemble≈0.6714`
`winner=strong`

## 10. Performance status

Длинный `operational:250` в этом проходе не завершился в 20-секундном окне.

Это не объявляется PASS.

P80/P82 E2E при этом завершился PASS в расширенном 30-секундном окне:

`tick=160, p80=160, p81=160, p82=160`.

Таким образом, correctness сохранён, но long-horizon mobile performance остаётся открытым направлением.

## 11. Regression / quality observations

Главный новый risk — не correctness, а стоимость расширенного cognition spine на длинных сериях.

Следующий performance target:

- сократить hot-path allocation;
- cache повторяющихся P30/P10/P26/P27 outputs внутри tick;
- ограничить multi-horizon pending queue по budget;
- вынести cold analytics из synchronous cycle;
- добиться устойчивого 250/500-cycle benchmark без роста latency/heap.

## 12. Текущие оценки

| Область | % |
|---|---:|
| Mobile readiness | 73 |
| Runtime robustness | 83 |
| Persistence | 91 |
| Evidence quality | 93 |
| Cognitive Budget | 85 |
| Prediction infrastructure | 87 |
| Learning | 75 |
| Agency | 80 |
| Autonomous projects | 77 |
| Reality grounding | 82 |
| Self / Identity | 73 |
| Long-horizon | 65 |
| Architecture consolidation | 52 |
| Perception | 60 |
| Native Android lifecycle | 20 |
| Social cognition | 43 |
| Consciousness research readiness | 50 |

Общая инженерная готовность проекта: **~72%**.

## 13. Следование плану

По исполнимым пунктам предыдущего отчёта: **~97%**.

По BIG PASS 40 machine-checklist: **100%**.

По исходным 20 пунктам первого аудита: **74% weighted implementation**.

## 14. Следующие большие проходы

### BIG PASS 41 — Performance Spine

1. Cache same-tick model outputs.
2. Reduce P30 repeated predictions.
3. Bounded self-prediction queue.
4. Batch evidence writes.
5. Move cold analytics out of hot path.
6. Stable 250/500 benchmark.

### BIG PASS 42 — True Project Execution

1. Project task graph instead of fixed 3-step templates.
2. Tool capability planning.
3. Retry/failure branches.
4. Evidence-gated step transitions.
5. External task executor.
6. Skill acquisition benchmark.

### BIG PASS 43 — OrganismCore Decomposition

1. Self API.
2. World API.
3. Memory API.
4. Learning API.
5. Agency API.
6. Embodiment API.
7. Event-only cross-boundaries.

### BIG PASS 44+ — Device / Perception

Native Android host, real lifecycle, thermal signals, vision backend, ASR/TTS and long-horizon real-device runs.

## 15. Permanent interpretation rules

- Internal score is not proof of consciousness.
- Simulation is not external evidence.
- Confidence is not correctness.
- Project completion is not independent validation.
- A successful test proves only the criterion it measured.
- Performance optimization must not remove core cognition.
