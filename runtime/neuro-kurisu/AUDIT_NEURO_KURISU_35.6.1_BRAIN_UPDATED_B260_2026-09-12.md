# Neuro-Kurisu 35.6.1 — обновлённый аудит мозговой ветви после B260

Дата: 2026-09-12
Базовая линия: B258
Предыдущий большой шаг: B259 — Canonical Neural Substrate
Текущий большой шаг: B260 — Recurrent Causal Memory

## 1. Главный вывод

B260 сделал следующий существенный переход: память теперь не просто соседний модуль, а временной источник delayed credit для общего recurrent-субстрата.

Новая цепочка:

`P27 observation latent -> B259 recurrent activity -> episodic trace -> memory binding -> real outcome -> delayed TD-like error -> replay -> B259 parameter update -> persistence`

Это значительно ближе к настоящему обучаемому brain loop, чем отдельные score-based органы.

## 2. Что было перепроверено

Перепроверены B259 implementation, P27 path, OrganismCore heartbeat/feedback path, memory encoding, hippocampal layer, persistence projection, migration, regression tests и audit stack.

Ключевой найденный архитектурный дефект B260 был обнаружен не нейронным тестом, а persistence round-trip: `RecurrentCausalMemory` отсутствовал в canonical migration path. Добавлены:

1. field в `OrganismSystemState`;
2. default persisted state;
3. migration passthrough;
4. restore path;
5. persistence projection;
6. core integration test.

## 3. Реально подтверждённые результаты

### B259

- learningUpdates = 20
- trainError01 = 0.4306
- holdoutError01 = 0.3440
- holdoutDelta01 = +0.1560
- generalization01 = 0.6560
- lesionDrop01 = 0.0000203
- restartPreserved = true

Вывод: механизм обучения реален, но causal necessity recurrent substrate пока очень слабая.

### B260 standalone

- encodingCount = 18
- outcomeCount = 18
- replayRuns = 1
- replayedEpisodes = 12
- meanAbsTd01 = 0.03825
- delayedCredit01 = 0.04696
- parameter update from replay > 0
- parameter state changes = true
- standalone persistence = PASS

### B260 full-core integration

- encodingCount = 18
- outcomeCount = 18
- replayRuns = 1
- replayedEpisodes = 12
- linkedMemoryCount = 4
- delayedCredit01 = 0.04514
- canonicalLearningUpdates = 30
- `OrganismCore` in-memory restart round-trip = PASS

### Existing regression

- B250–B258 = PASS
- B242–B249 = PASS
- P26 true learning = PASS
- typecheck = PASS

### Global audit state

- architecture: PASS — 946 source files / 343 canonical files / 0 cycles / 0 legacy leakage
- integrity: PASS — 1886 files
- source hygiene: PASS — 1880 files / 0 errors / 0 warnings
- full project audit: PASS — 1880 files / 343 canonical files / 0 warnings / 0 errors
- release contract: PASS
- lockfile: PASS
- release source: PASS
- archive manifest: PASS — 2111 files
- archive verification: PASS — missing 0 / hash mismatches 0 / extra 0

## 4. Важнейшее ограничение

Полный исторический `tests/restart-persistence.mjs` использует настоящий `FileStateStore` и в рабочей container filesystem воспроизводимо получает `EIO` на `fsync` во время checkpoint.

Это НЕ превращаем в ложный PASS.

Отдельно проверенная B260 persistence semantics через `OrganismCore` in-memory `JsonStateStore` проходит и подтверждает, что state B260 действительно включён в migration/restore/projection.

Следующий release-grade device gate должен быть повторён на реальном Android/Termux filesystem.

## 5. Что теперь работает правильно

### Shared substrate

B259 продолжает получать real P27 fused latent и interoceptive context.

### Temporal memory

B260 сохраняет activity состояния и связывает его с outcome, а delayed replay способен позднее изменить trainable parameters.

### Memory coupling

Trace можно связать с реальным `memoryId`, поэтому replay теперь не только абстрактный neural buffer.

### Persistence

B260 state проходит OrganismCore snapshot -> migration -> restore -> snapshot.

## 6. Что всё ещё сделано недостаточно хорошо

### 6.1 Causal necessity

Lesion B259 всё ещё почти нулевой. Значит, система может пока обходить canonical recurrent substrate.

### 6.2 Replay proof

Replay показывает, что параметры меняются, но ещё не доказано, что replay materially улучшает delayed transfer относительно online-only baseline.

### 6.3 World model coupling

P27 и B259 связаны с observation, но unified action-conditioned world dynamics всё ещё распределены между несколькими historical modules.

### 6.4 Memory hierarchy

HippocampalMemorySubstrate и B260 пока связаны через memory ids и common lifecycle, но ещё не образуют полностью единую differentiable/recurrent consolidation pathway.

### 6.5 Phone reality

Фактическая Android/Termux fsync/device gate должен быть проверен на реальном телефоне отдельно.

## 7. Оценки после B260

| Элемент | Оценка |
|---|---:|
| Архитектурная целостность | 96 |
| Persistence architecture | 93 |
| Evidence infrastructure | 96 |
| Cognitive orchestration | 86 |
| Shared neural substrate | 60 |
| Recurrent dynamics | 52 |
| Parameter learning | 66 |
| Temporal credit | 61 |
| Causal learning | 67 |
| Replay | 63 |
| Memory integration | 77 |
| World model | 66 |
| Sensorimotor loop | 46 |
| Agency coupling | 67 |
| Self-model coupling | 69 |
| Phone embodiment | 58 |
| Consciousness empirical evidence | 8 |
| Strict evidence coverage | 13 |
| Brain branch engineering readiness | 65 |
| Brain branch scientific maturity | 44 |

## 8. Прогресс по мозговой ветви

- исходный аудит перепроверен: 100%
- B259 implementation: 100%
- B259 scientific completion: ~54%
- B260 implementation: 100%
- B260 integration: 100%
- B260 scientific completion: ~68%
- unified causal loop: ~52%
- brain branch overall engineering: ~65%
- brain branch overall scientific maturity: ~44%

## 9. Главный следующий шаг

B261 — Unified World Model 2.

Нужно прекратить дальнейшее разветвление world-model модулей и собрать один action-conditioned dynamics path вокруг общего latent/recurrent state.

Минимальные обязательные эксперименты:

1. online-only vs replay-enabled;
2. recurrent lesion vs intact;
3. memory lesion vs intact;
4. unseen context transfer;
5. delayed reward task;
6. action-conditioned prediction;
7. real-world observation reconciliation;
8. restart preservation;
9. mobile resource pressure;
10. adversarial perturbation.

## 10. Критерий завершения brain branch

Не число файлов и не число passes.

Материальная завершённость начинается только после закрытия цикла:

`real observation -> shared representation -> recurrent state -> prediction -> memory/workspace/self-world -> action -> real consequence -> prediction error -> causal credit -> plasticity -> consolidation -> transfer`

И после доказательства, что этот цикл действительно причинно влияет на поведение и обучение через контролируемые ablation experiments.
