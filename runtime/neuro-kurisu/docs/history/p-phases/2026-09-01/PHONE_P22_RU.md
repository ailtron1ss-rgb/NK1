# P22 — Phone Reliability & Truthfulness

## Зачем
P22 — первый большой reliability-шаг после P21. Его задача не в добавлении новых “органов мозга”, а в том, чтобы существующие органы работали честно и экономно на среднем телефоне.

## Три большие итерации проекта

### Итерация 1 — P22: Phone Reliability & Truthfulness
Статус: **реализовано в этом архиве**.

Фокус:
- устойчивый автономный цикл;
- adaptive cadence;
- thermal/battery/RAM-aware scheduling;
- отдельный sensor cadence;
- batched world persistence;
- one-call chat;
- явный deliberate reasoning;
- актуальный LLM default;
- operational telemetry;
- физические 24/72/168h device gates как следующий verification этап.

Нестандартные механизмы, введённые здесь:
- **Energy-to-Information Economy** — чем дороже вычисление, тем выше требуемая ожидаемая информационная ценность; P22 закладывает эту политику через cognitive budget/cadence вместо постоянного максимального цикла.
- **Failure is a Sensor** — медленный цикл, thermal rise, RAM pressure и battery pressure считаются причинами менять собственную стратегию работы, а не просто ошибками внешней среды.
- **Memory Thermodynamics подготовлена как следующий слой**: persistence budget теперь отделён от когнитивного состояния и может стать базой для storage-cost/utility оптимизации в P23.

### Итерация 2 — P23: True Learning & Counterfactual Development
Статус: **впереди**.

Цель — перейти от эвристического накопления метрик к измеримому изменению поведения от опыта.

Крупные блоки:
1. Counterfactual replay: повторный прогон исторических состояний.
2. Before/after evaluation: baseline против обученной политики.
3. Настоящий shadow agent с отдельным состоянием.
4. Skill promotion через offline validation, а не только threshold.
5. External/blind evaluator.
6. Self-ablation: автоматическая проверка пользы каждого важного когнитивного модуля.
7. Cognitive checksum для важных убеждений: claim + evidence + provenance + verification age.
8. Evidence Debt Market: конкуренция гипотез за ограниченный вычислительный бюджет.

### Итерация 3 — P24: World Model, Multimodal Embodiment & Long-Lived Identity
Статус: **впереди**.

Цель — превратить текущие scaffolds в более реальные learned mechanisms:
1. learned temporal world model;
2. semantic vision;
3. semantic audio;
4. cross-modal latent situation;
5. phone-as-body model (battery, thermal, latency, storage, network как часть мира организма);
6. temporal compression памяти;
7. behavioral genome;
8. boredom/novelty-driven exploration;
9. true model-switch verification;
10. long-horizon physical validation.

## Правило P22+
Новый модуль не принимается в канон только из-за красивой идеи. Для него должна существовать измеримая baseline-vs-module проверка с ценой по CPU/RAM/storage/latency/energy и влиянием на качество поведения.
