# Neuro-Kurisu — CROSS-SYSTEM PASS R11 — 2026-09-25

## Цель прохода

R11 продолжил R10 не расширением количества подсистем, а закрытием сквозных архитектурных разрывов между provenance, learning, memory, identity, world-model и durable persistence.

## Реально выполнено

### 1. Learning Provenance Closure

`OrganismCore.feedback()` теперь передаёт downstream learning-компонентам канонические gated-сигналы:

- `reward01`
- `success01`
- `surprise01`

Гейт зависит от источника опыта. Simulation не может напрямую давать полный learning signal; external evidence может давать более сильный signal только при соответствующем provenance.

Добавлены exact forwarded fields в `LearningProvenance` и интеграционный тест `tests/r11-learning-provenance-closure.mjs`.

Добавлен статический guard:

`audit:r11:learning-provenance`

Результат: `8` правил, `0` нарушений. Raw outcome остаётся только на явно разрешённых evaluation/ground-truth границах.

### 2. World hot-path

Сохранён и перепроверен R10-ремонт `WorldEnvironment`:

старый prediction hot-path клонировал world/history; новый path использует чистое projection/prediction поведение.

Контрольный benchmark из R10/R11:

`~34.0 s -> ~0.12 s` на 1000 пар прогнозов, около `283x` ускорение, при сохранении canonical state/history.

### 3. Durability governor

`feedback()` больше не принуждает full durable checkpoint на каждом цикле.

Теперь используется существующий bounded durability governor. Полный checkpoint остаётся у:

- `flush()`;
- critical lifecycle operations;
- dirty-cycle/time boundary.

Это уменьшает постоянную сериализацию и GC pressure на mobile runtime.

### 4. Canonical recovery hash

`FailureRecoveryCertification` больше не выполняет повторный `structuredClone + JSON stringify + SHA-256` при каждом durable checkpoint.

Canonical durable hash вычисляется один раз через `IntegritySentinel` и переиспользуется recovery certificate.

Recovery certificate создаётся только после завершения final durable projection.

`tests/r11-durable-recovery-certification.mjs` проверяет:

- partial checkpoint не сертифицируется;
- full `flush()` создаёт новый certificate;
- `lastStateHash === lastCheckpointHash`;
- durable snapshot действительно проходит recovery verification;
- manual recovery работает;
- tampering отклоняется.

Результат: PASS.

### 5. B285 continuity semantics

Старый тест сравнивал live snapshot с restart и тем самым требовал немедленной durable записи на каждом feedback.

Тест переведён на фактически сохранённый durable snapshot.

В мобильном профиле наблюдается допустимая bounded-history разница:

- live B285 episode window: `21`
- durable B285 window: `12`
- restart restored window: `12`

Restart проверяется именно относительно durable image.

### 6. Regression coverage

Добавлены/обновлены:

- `tests/r11-learning-provenance-closure.mjs`
- `tests/r11-durable-recovery-certification.mjs`
- `tests/big-pass-285-core-life-consolidation.mjs`
- `scripts/audit-r11-learning-provenance.mjs`
- `package.json` scripts `audit:r11:learning-provenance`, `test:r11:durable-recovery`

## Verification

### Architecture

- sourceFiles: `1686`
- canonicalFiles: `538`
- missing: `0`
- cycles: `0`
- legacyLeakage: `0`
- OrganismCore direct constructors: `5`

### Hygiene / integrity

- hygiene errors: `0`
- hygiene warnings: `0`
- syntax: PASS
- integrity: PASS
- release contract: PASS
- release source: PASS
- archive manifest: PASS

### Function reality

- source files: `1699`
- functions with body: `5486`
- zero references: `306`
- semantic verified: `34 / 5268`
- parameterized attempted: `1206`
- parameterized passed: `1143`
- parameterized failed: `0`

Semantic coverage намеренно не «рисовалась»: низкий процент отражает реальную доказательность текущего runtime.

### P2855

Contextual:

- holdoutAccuracy: `1.0`
- retention: `1.0`
- updates: `1200`
- persisted: `true`

Integration:

- cycles: `84`
- policy updates: `84`
- policy selections: `84`
- persisted: `true`

Ablation:

- policy-on accuracy: `0.266666...`
- policy-off accuracy: `0.166666...`
- absolute gain: `0.10`

### Runtime smoke

- organism smoke: PASS
- server smoke: PASS
- B285 restart: PASS
- provenance closure: PASS
- durable recovery certificate: PASS

### 50-cycle mobile benchmark

Финальный R11 run:

- cycles: `50`
- elapsed: `30.15 s`
- mean: `602.9 ms`
- p50: `520.4 ms`
- p95: `1294.8 ms`
- max cycle: `1521.8 ms`
- max heap: `357.85 MB`
- full checkpoints: `10`
- checkpoint total: `816 ms`
- recovery certification: `0 ms` дополнительной полной сериализации
- stamp: `94 ms`
- save: `92 ms`

Предыдущий R11 benchmark до canonical recovery refactor:

- elapsed: `32.19 s`
- mean: `643.7 ms`
- p95: `1521.2 ms`
- max heap: `389.1 MB`
- full checkpoints: `10`
- recovery: `495 ms`

Измеренный результат прохода: примерно `-6.4%` mean cycle time, `-14.9%` p95 и `-8.0%` max heap относительно этого контрольного R11 run. Эти числа относятся к одинаковому 50-cycle harness и не являются универсальным Android benchmark.

## Quality limitations, не скрытые

`audit:all` останавливается на strict forensics из-за существующих very-long-line участков:

- `README.md`
- `B2523MultiHorizonCounterfactualVerifier.ts`
- несколько участков `OrganismCore.ts`

`audit:full` при этом: `ok=true`, только warnings.

Semantic evidence всё ещё существенно отстаёт от размера проекта. Следующий проход должен увеличивать доказанную behavioural coverage критического runtime, а не просто количество тестовых деклараций.

1000-cycle mobile endurance остаётся отдельным незакрытым performance target: R11 улучшил checkpoint/GC cost, но полноценный длительный endurance benchmark ещё требует отдельного прохода.

## Внешние ориентиры

R11 сверял architecture direction с Norse и DreamerV3.

Norse показывает практическое разделение stateful spiking components и learning-compatible neural infrastructure. DreamerV3 отделяет world-model, replay, imagination и actor/critic paths. Эти идеи использованы как архитектурные ориентиры; внешний код не переносился механически в TypeScript/Termux runtime.

## Следующий проход R12

1. Закрыть remaining raw outcome paths в developmental learning через typed provenance capability, а не line-level rules.
2. Поднять behavioural evidence критических 100–200 функций реальными integration/ablation tests.
3. Разобрать 250/500/1000-cycle memory/GC profile с retained-heap контрольными точками.
4. Проверить bounded-loss semantics всех long-lived neural states, не только B285.
5. Начать следующий реальный neural-learning слой только после повышения evidence coverage критического runtime.
