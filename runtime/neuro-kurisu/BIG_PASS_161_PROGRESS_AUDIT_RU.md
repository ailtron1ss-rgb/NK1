# Neuro-Kurisu — BIG PASS 161: Semantic Verification + Unified Cognitive Event Fabric

## 1. Статус прохода

Цель прохода: превратить принцип «код существует ≠ функция реализована» в постоянный инженерный механизм и одновременно связать operational life в единую causal chain.

### Реально внедрено

1. **Semantic Coverage Engine** расширен до строгой evidence-first модели.
2. Статус функции теперь вычисляется из evidence, а не принимается из отчёта как истина.
3. Добавлена классификация `UNSAFE_TO_AUTO_RUN` для destructive/external-side-effect кандидатов.
4. Выполнен полный AST inventory исходного кода: **2355 function-like declarations**.
5. Добавлен безопасный zero-argument export sweep: **25 кандидатов / 9 реально выполнены / 0 ошибок / 16 намеренно пропущены как stateful или небезопасные**.
6. Добавлен `CognitiveEventFabric` — тонкий causal ledger поверх уже существующих EventLog/RuntimeEvidence, без создания второго canonical memory/world store.
7. Operational runtime теперь связывает observation → prediction → action → outcome → learning → self-update.
8. Causal chain сохраняется в `system.cognitiveEventFabric`.
9. Добавлена migration support для persistence.
10. Добавлен реальный restart verification для causal fabric.
11. Добавлены machine-readable traces/reports.
12. Добавлена обновлённая система метрик `verifiedRate01` и `evidenceCoverage01`.

## 2. Реальные проверки

### PASS

- TypeScript typecheck
- architecture DAG / cycle check
- integrity audit
- syntax audit
- source forensics
- brain audit
- BIG PASS 157 core
- BIG PASS 157 restart
- BIG PASS 157 server
- BIG PASS 128–154 core
- P34 integration
- P26 true learning
- P24 world identity
- P28 integration
- P29 integration
- P30 integration
- P18 long horizon
- P20 temporal continuity
- BIG PASS 160 semantic runtime
- BIG PASS 161 function sweep
- BIG PASS 161 cognitive event fabric

### Что намеренно НЕ объявлено PASS

Полная длинная orchestration-цепочка старых проходов не является одновременно доказанной в одном запуске: предыдущий combined runner упирался во временной лимит. Отдельные ключевые регрессионные этапы перечислены только тогда, когда они реально запускались и завершались с exit code 0.

Physical Android execution, многонедельная непрерывная жизнь и consciousness/phenomenal claims этим контейнерным тестированием не доказаны.

## 3. Semantic coverage — реальная картина

| Статус | Количество |
|---|---:|
| VERIFIED | 3 |
| INTEGRATION_ONLY | 227 |
| UNSAFE_TO_AUTO_RUN | 214 |
| UNVERIFIED | 1911 |
| ВСЕГО | 2355 |

**Strict VERIFIED rate: 0.13%**

**Evidence coverage: 2.54%** (интеграция даёт только 25% кредита и не считается полностью внедрённой).

Эти цифры являются консервативной оценкой. Большая часть `UNVERIFIED` — не обязательно нерабочий код; это код без достаточного доказательства по новому стандарту.

## 4. Brain branch

Из 2355 functions примерно **1916** попадают в когнитивную/ядровую область по текущему классификатору.

| Статус | Brain functions |
|---|---:|
| VERIFIED | 3 |
| INTEGRATION_ONLY | 227 |
| UNSAFE | 154 |
| UNVERIFIED | 1532 |

Отсюда следует основной инженерный вывод: **главная работа следующего этапа — не добавление новых подсистем, а массовая behavioral verification и causal integration существующих подсистем.**

## 5. Cognitive Event Fabric — доказанный результат

Для 4 реальных operational cycles:

- 24 causal nodes;
- 36 linked parent references;
- 0 dangling parent links;
- lineage integrity = **1.0**;
- cycle coverage = **1.0**;
- learning/self-update nodes присутствуют;
- после restart: total=24, buffered=24, lineage integrity=1.0.

То есть causal chain реально сохраняется, восстанавливается и проверяется после перезапуска.

## 6. Что стало лучше архитектурно

`CognitiveEventFabric` не заменяет существующую память или world model. Он фиксирует причинный скелет operational life и позволяет связать уже существующие источники истины.

Это открывает единый путь для:

- replay;
- causal debugging;
- semantic coverage;
- longitudinal experiments;
- state-diff validation;
- self-development evidence;
- reality/simulation separation;
- consciousness perturbation experiments.

## 7. Что осталось слабым

1. Большая часть функций ещё `UNVERIFIED`.
2. Zero-argument sweep покрывает только безопасный subset: он не доказывает поведение методов с аргументами.
3. Значительная часть evidence пока относится к integration-only, а не к полному postcondition/persistence proof.
4. Physical Android sensorimotor loop не доказан в реальном устройстве.
5. Longitudinal life на днях/неделях не прошла полноценную container-independent experimental certification.
6. External-world causal evidence остаётся частичным.
7. Consciousness remains a research question; engineering metrics are not phenomenal evidence.

## 8. Пессимистичный прогресс

| Область | Оценка |
|---|---:|
| Software/research platform | 7.0/10 |
| Architecture | 7.0/10 |
| Persistence/continuity infrastructure | 8.0/10 |
| Verification infrastructure | 8.0/10 |
| Cognitive integration | 6.0/10 |
| Memory | 7.5/10 |
| Agency | 6.5/10 |
| Learning | 5.5/10 |
| World model | 5.5/10 |
| Emotion/affect | 4.0/10 |
| Self model | 6.0/10 |
| Social cognition | 4.5/10 |
| Real embodiment | 3.5/10 |
| Longitudinal autonomy | 3.5–4.0/10 |
| Human-like general intelligence | 3.0/10 |
| Evidence of phenomenal consciousness | not established |

## 9. Следующие большие проходы

### BIG PASS 162 — Semantic Verification 2.0

1. Инструментировать parameterized functions.
2. Генерировать input schemas из TypeScript signatures.
3. Строить pre/postcondition contracts.
4. Проверять state deltas.
5. Проверять emitted events.
6. Проверять persistence/restart для stateful functions.
7. Вводить adversarial inputs.
8. Привязывать доказательство к конкретному function ID.
9. Поднимать verified functions из `INTEGRATION_ONLY` в `VERIFIED` только при полном evidence.

### BIG PASS 163 — Unified Cognitive Cycle 2.0

1. observation
2. prediction
3. appraisal
4. attention
5. memory
6. goal
7. planning
8. action
9. consequence
10. learning
11. self-update

Каждый stage должен иметь input/output contract и causal lineage.

### BIG PASS 164 — Memory Economy

Объединить retention/retrieval/consolidation/forgetting вокруг единой utility function и проверить изменение будущего поведения.

### BIG PASS 165 — Emotion/Feeling Episodes

Перейти от scalar scores к временным appraisal-driven episodes, связанным с interoception, attention, action tendency и memory tagging.

### BIG PASS 166 — Reality/Simulation Dual Ledger

Simulation evidence не должна напрямую повышать reality confidence.

### BIG PASS 167 — Autonomous Life Projects

Появление устойчивых собственных проектов на дни/недели вместо только локальных goals.

### BIG PASS 168 — Longitudinal Emergent Personality

Многодневные/многонедельные seeded runs, ablation, baseline comparison и effect sizes.

### BIG PASS 169 — Real Android Sensorimotor Loop

Реальный device observation → action → external postcondition → observation → learning.

### BIG PASS 170 — Consciousness Research Battery

GWT/HOT/recurrent/predictive/IIT-inspired hypotheses + perturbation/lesion tests без заранее принятого вывода.

## 10. Уникальные архитектурные идеи для следующих проходов

### Prediction Debt Market

Нерешённые prediction errors получают стоимость и конкурируют за attention/computation budget.

### Cognitive Scar Tissue

Личность формируется как статистически устойчивые последствия повторных событий, а не как статические traits.

### Model Disagreement Gate

Если fast predictor, world model и causal model сильно расходятся, система обязана предпочесть investigation вместо уверенного действия.

### Three-Timescale Mind

Fast loop для реакции, mid loop для решения и slow loop для рефлексии, обучения и изменения self-model.

### Cognitive Resource Scarcity

Battery/thermal/RAM/LLM budget становятся частью cognition, чтобы автономность учитывала реальные ограничения телефона.

## 11. Главный критерий дальнейшего прогресса

Не количество новых классов.

Не размер кода.

Не количество PASS-тестов.

Главный KPI:

> **доля реальных причинно связанных поведенческих pathways, доказавших изменение будущего поведения после опыта.**

Это следующий настоящий переход проекта: от большой архитектуры к проверяемому искусственному организму.
