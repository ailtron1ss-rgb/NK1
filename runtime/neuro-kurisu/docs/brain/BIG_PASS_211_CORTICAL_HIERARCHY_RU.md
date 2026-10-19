# BRAIN-211 — корковая иерархия и распределённое предиктивное маршрутизирование

## Статус

**Прогресс:** реализован и прошёл release-gate.

**Исходная база:** BRAIN-210 Master Plan, архив BRAIN-210, код Neuro-Kurisu 35.6.1.

**Код изменён:** да.

**Источник научного направления:** свежая проверка исследований по функциональной иерархии коры, распределённым когнитивным сетям и энергоэффективной brain-inspired/neuromorphic обработке.

## Что реально добавлено

1. `src/organism/system/CorticalHierarchyEngine.ts`
   - 6 вычислительных уровней: `sensorimotor → unimodal → multimodal → control → self → global`.
   - bottom-up evidence + top-down prediction + рекуррентное состояние.
   - adaptive depth: глубина вычисления растёт при неопределённости, ошибке предсказания, новизне и целевом давлении и сокращается при нехватке энергии/ёмкости, тепловом риске и memory pressure.
   - измеряемые `coherence`, `contradiction`, `precision`, `predictionError`.
   - bounded hierarchy gain влияет на score кандидатов действия, но не получает право полностью переопределять downstream-подсистемы.
   - outcome learning и сохранение route models.
   - snapshot/restore.

2. `CognitiveKernelCoordinator.ts`
   - новый cortical pass встроен между cerebellar calibration и action arbitration.
   - корковая оценка влияет на score, predicted utility и confidence.
   - состояние cortical hierarchy включено в coordinator snapshot/restore.

3. `OrganismCore.ts` + `StateMigrations.ts`
   - state persisted через общий организмский persistence path.
   - добавлена миграция/восстановление для нового состояния.

4. `ArtificialBrainAtlas.ts`
   - cortex получает `CorticalHierarchyEngine` как реального owner.
   - добавлена verified recurrent predictive edge cortex→cortex.
   - release label обновлён до B211.

5. `tests/big-pass-211-cortical-hierarchy.mjs`
   - unit proof.
   - adaptive-depth proof.
   - contradiction attenuation proof.
   - learning proof.
   - direct snapshot/restore proof.
   - coordinator integration proof.
   - Core restart/persistence proof.

## Главный инженерный результат

B211 не пытается «отрисовать кору». Он превращает иерархию в реальный вычислительный механизм управления точностью, глубиной и степенью доверия к когнитивным гипотезам.

Это полезно для искусственного организма даже без биологической аналогии, потому что тот же контур выполняет функции:

- adaptive compute throttling;
- early contradiction detection;
- confidence calibration;
- multiscale state integration;
- bounded influence on action arbitration;
- persistence of learned routing behaviour.

## Проверенные результаты

### Adaptive depth

Высокая неопределённость/новизна/ошибка при достаточном ресурсе:

- depth = **5/6**
- mode = **deep**
- global coherence = **0.9520**
- global contradiction = **0.0747**

Режим дефицита ресурса:

- depth = **2/6**
- mode = **shallow**

То есть глубина является измеряемой функцией контекста, а не константой.

### Causal contradiction response

Для `explore`:

- normal hierarchy gain = **0.9826**
- contradictory prediction gain = **0.8899**
- contradiction score вырос до **0.3913**.

Следовательно, противоречивое top-down ожидание реально уменьшает влияние маршрута перед выбором действия.

### Learning

После 16 outcome updates:

- route-model samples = **16**
- mean learned error = **0.1893**.

### Persistence

Core после 4 реальных observation cycles:

- cortical hierarchy cycles = **4**.
- после restart значение циклов восстановлено = **4**.
- route models восстановлены побитово на уровне структурного equality.

## Release-gate

- TYPECHECK: PASS
- B207 regression: PASS
- B208 regression: PASS
- B209 regression: PASS
- B211 targeted test: PASS
- Function passport gate: PASS
- Total functions: **2742**
- VERIFIED: **14**
- INTEGRATION_ONLY: **27**
- UNSAFE_TO_AUTO_RUN: **129**
- UNVERIFIED: **2572**
- Architecture: PASS, `sourceFiles=877`, `canonicalFiles=296`, `cycles=0`
- Integrity: PASS
- Source hygiene: PASS, `errors=0`, `warnings=0`
- Syntax: PASS, `js=600`, `sh=4`, `json=135`
- Release contract: PASS
- Forensics: PASS, `activeFiles=1728`, `empty=0`, `duplicateContent=0`, `duplicateNames=0`, `pathMarkers=0`, `staleMarkers=0`
- Release source: PASS
- Archive manifest: PASS, `files=1974` before adding this report bundle; final archive count is recorded in manifest after packaging.

## Исправленный дефект во время B211

Полная release-проверка впервые остановилась на старом артефакте BRAIN-210: `BRAIN_MASTER_PLAN_210_SHA256.txt` содержал абсолютные пути от локальной среды сборки.

Это не было замаскировано. Checksum-файл переписан в portable relative-path form, после чего integrity gate прошёл.

## Научная перепроверка направления

Свежие работы показывают, что полезная модель коры не сводится к жёсткой лестнице областей. Важны плавные функциональные градиенты, распределённые сети, recurrent/subcortical interactions и mode-dependent computation.

Исходя из этого B211 использует не анатомический список зон, а вычислительную композицию `hierarchy + gradients/abstraction + recurrence + adaptive depth + contradiction gating`.

## Использованные актуальные источники

1. Functional hierarchy of the human neocortex across the lifespan — Nature, 2026.
   https://www.nature.com/articles/s41586-026-10219-x
2. How distributed is the brain-wide network that is recruited for cognition? — Nature Reviews Neuroscience, 2026.
   https://www.nature.com/articles/s41583-025-00992-5
3. Rethinking hierarchy: the auditory system as an integrated cortical–subcortical network — Nature Reviews Neuroscience, 2026.
   https://www.nature.com/articles/s41583-026-01045-1
4. The new NeuroAI — Nature Machine Intelligence, 2024.
   https://www.nature.com/articles/s42256-024-00826-6
5. Efficient training of neuromorphic electronics — Nature Electronics, 2026.
   https://www.nature.com/articles/s41928-026-01631-2
6. Figures of merit for neuromorphic devices through biological emulation efficacy — Nature Reviews Electrical Engineering, 2026.
   https://www.nature.com/articles/s44287-026-00321-7

## Что B211 сознательно НЕ заявляет

- не заявляет анатомическую эквивалентность коре человека;
- не заявляет феноменальное сознание;
- не заявляет физическую экономию батареи телефона;
- не считает функцией «реализована» только факт наличия файла/класса;
- не считает host/model evidence доказательством device truth.

Следующий шаг B212 по master plan: **cortical microcircuits** — перейти от межуровневой иерархии к более локальным recurrent microcircuit motifs, с тем же обязательным протоколом причинности, абляции и persistence.
