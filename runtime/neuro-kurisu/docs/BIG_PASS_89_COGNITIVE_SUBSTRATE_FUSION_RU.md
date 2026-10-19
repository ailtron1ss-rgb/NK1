# BIG PASS 89 — Cognitive Substrate Fusion

## Цель
Сделать следующий переход Neuro-Kurisu от множества независимых P-фасет к общему hot-path substrate без удаления исследовательских модулей.

## Реализовано
- Добавлен `WorldContextNormalizer` как единая безопасная граница внешних world observations.
- `OrganismCore.observe()` теперь нормализует `worldContext` один раз перед downstream world/body/memory processing.
- `P83PersistentRealityModel` стал tolerant к неполному/частичному WorldContext.
- `PersistenceProjectionCoordinator.snapshotOnce()` теперь безопасен для отсутствующих optional providers.
- `CognitiveFrame` расширен `dirtyDomains`, `attentionBudget01`, `deepDemand01`.
- `CognitiveExecutionPlanner` получил net expected-value-of-cognition: дорогая работа больше не форсируется одним фактом внешнего ввода.
- `CognitiveSpineScheduler` теперь различает wake-up от пользователя и действительно urgent signal; обычный текст/телеметрия не заставляют дорогие loops работать каждый цикл.
- Добавлен targeted test `BIG_PASS_89_COGNITIVE_SUBSTRATE`.

## Принцип
Не добавлять P-модуль ради числа. Сначала усиливать связи, shared signals, causal continuity и resource economics.

## Следующий этап
- общий `CognitiveFrame`/event stream для memory/world/self/social;
- dirty dependency graph;
- unified P26/P30 learning substrate;
- event-driven memory consolidation;
- real semantic vision;
- phone long-horizon certification.

Статус этого прохода: code changes implemented; release gate проходит только после полного targeted + broad regression.
