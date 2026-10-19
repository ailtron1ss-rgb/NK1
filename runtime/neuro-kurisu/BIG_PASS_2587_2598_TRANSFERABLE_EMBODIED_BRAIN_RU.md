# GIANT PASS P2587–P2598 — Transferable Embodied Brain

## 1. Главный результат

Этот блок перестраивает слабое место предыдущей версии: поведение больше не обязано зависеть от точного состояния или от одного ближайшего воспоминания. Добавлен слой переносимых процедурных навыков, связанный с world model и единым нейронным контуром.

## 2. Что внедрено

### 2.1 TransferableEmbodiedSkillSystem
Компактная procedural memory:
- context prototype;
- action-conditioned delta prototype;
- successorFeature;
- reward, success, confidence, stability;
- uncertainty and contradiction;
- usage/source count;
- option-like temporal abstraction.

Система выбирает навык по сходству и устойчивости, отслеживает negative transfer и умеет включать intervention/recovery режимы.

### 2.2 H1/H2/H4/H8/H16 world-model ladder
Все действия получают дешёвый H1. Более дальние горизонты вычисляются селективно.

- обычный бюджет: H1/H2/H4;
- повышенный: H8 для лучших кандидатов;
- очень высокий: H16 для одного кандидата.

Это уменьшает бездумное расходование CPU и одновременно делает долгие последствия частью action arbitration.

### 2.3 Causal-effect focused learning
В обучении embodied dynamics теперь увеличивается вес latent-компонент, реально изменившихся относительно действия. Это лёгкая CAER-inspired эвристика, а не копия оригинального метода.

### 2.4 B2521 перестроен
Добавлен hierarchical fallback:
`exact key → nearest prototype → global action prior`.

Из-за этого unseen states перестают автоматически выдавать нулевую модельную поддержку.

### 2.5 Unified neural integration
Новый слой встроен внутрь `NeuralExperienceBranch`, а не существует отдельным демонстратором:
`neural substrate → continuity → embodied world model → causal planner → transferable skill → evidence gate → action → outcome → learning → rehearsal/persistence`.

## 3. Проверка

Добавлены четыре новых benchmark/pass теста:
- transferable embodied brain;
- neural integration + persistence;
- long-horizon + B2521 transfer;
- performance.

Дополнительно повторены P2575–P2586 dream/integration/performance и более ранние embodied/world-gate проверки.

## 4. Текущие ограничения

Главный новый слабый участок: в полном NeuralExperienceBranch при сильно меняющемся контексте procedural skill bank быстро фрагментируется до 48 навыков, а `optionCoverage01` остаётся около 0.049. Следующий блок должен делать hierarchical skill consolidation / merging и независимый task-id-free transfer benchmark.

Другие ограничения остаются: реальные Android thermal/RAM measurements не заменены синтетическим Node benchmark; внешняя мультимодальная заземлённость пока слабее внутреннего субстрата; B2521 всё ещё не следует считать открытым world-generalization доказательством.

## 5. Следующий гигантский блок

P2599–P2612:
- skill consolidation / merge;
- task-id-free cross-domain transfer;
- intervention benchmark with adversarial distractors;
- recovery-after-model-failure episodes;
- latent compactification;
- true asynchronous sensor adapters;
- Android thermal-aware scheduling;
- stronger autonomy/goal coupling;
- continuous identity-linked learning traces.

## 6. Дополнительная перепроверка после завершения блока

После основного внедрения повторно проверены typecheck, архитектура, hygiene, contract, forensics, full audit, brain audit, integrity, syntax и release-source. Все эти проверки прошли. Aggregate `release:audit` превысил установленное окно на позднем regression этапе; каждый неуспевший aggregate-компонент затем был отдельно выполнен и прошёл, включая `p2559-2566:runtime`.

Добавлен baseline `consolidateSkills()` для защиты от skill-bank fragmentation. Он корректно компилируется и сохраняется через state, однако в текущем integrated benchmark не показал измеримого улучшения option coverage. Поэтому он классифицирован как реализованный экспериментальный механизм, а не как доказанный прирост.
