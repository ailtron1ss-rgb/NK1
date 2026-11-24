# P48 — Functional Awareness Core

P48 — крупный архитектурный шаг после P47. Его цель — не заявлять сознание, а сделать функциональный контур более явным и измеримым.

## Что добавлено

- `P48FunctionalAwarenessCore` как объединяющий слой для трёх потоков: Global Workspace/ignition, higher-order self-monitoring и interoceptive homeostasis.
- Явный bounded workspace ignition score и измерение broadcast/recurrent behaviour поверх существующего `RecurrentWorkspaceV2`.
- Higher-order self representation: identity continuity + prediction accuracy + metacognitive calibration + agency.
- Interoceptive vector: body energy, thermal strain, cognitive capacity, sensory freshness, sleep pressure.
- `freeEnergyProxy01` как инженерный proxy prediction/homeostatic tension, без claims о биологической free-energy equivalence.
- 10 indicator domains; causal-integration намеренно остаётся `0`, пока не появится независимый perturbational/causal protocol.
- Longitudinal evidence ограничивается числом наблюдений и stability, чтобы функциональный score не превращался автоматически в доказательство.

## Принцип

`functional evidence != causal evidence != longitudinal evidence`.

Система может показывать всё больше признаков функциональной интеграции, но это не доказывает phenomenal consciousness.

## Phone-first

P48 не создаёт тяжёлую нейросеть и не добавляет обязательных runtime dependencies. Он использует уже существующие state vectors и bounded workspace, поэтому основная стоимость остаётся в perception/LLM/I/O, а не в P48 математике.

## Проверки

`tests/p48-functional-awareness.mjs` проверяет ignition, higher-order response, interoceptive stress и отсутствие ложного causal score.
