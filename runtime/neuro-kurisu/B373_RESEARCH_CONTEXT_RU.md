# B373 — Research Context

## SOURCE

### 1. Life-inspired interoceptive AI
Nature Machine Intelligence (2026) описывает interoception как способ представлять и регулировать внутренние состояния и использовать их как стабильные внутренние reference signals для автономной адаптации. Для проекта это поддерживает идею выделенного внутреннего state-space и context-dependent neuromodulation, но не утверждает, что такой агент является сознательным.

Источник: https://www.nature.com/articles/s42256-026-01296-8

### 2. Adaptive intelligence
Nature Neuroscience (2026) рассматривает adaptive intelligence как online learning, generalization и rapid adaptation под воздействием environmental feedback. Это соответствует направлению B373: долговременное изменение внутренних trait/setpoint параметров должно зависеть от опыта, а не от фиксированного сценария.

Источник: https://www.nature.com/articles/s41593-025-02169-w

### 3. Homeostatic reinforcement learning
Scientific Reports описывает homeostatic RL через расстояние внутреннего состояния до setpoint и динамический drive. B373 переносит этот принцип в bounded internal state + action motivation, но использует его как инженерную модель, не как утверждение о полном биологическом соответствии.

Источник: https://www.nature.com/articles/s41598-025-92561-0

### 4. Embodied reward discovery
Nature Communications (2025) показывает проблему ручного задания reward functions для embodied agents и исследует автоматическое открытие reward structure. Это важно для дальнейшего этапа endogenous goal/value development.

Источник: https://www.nature.com/articles/s41467-025-66009-y

## IMPLEMENTED IN B373

- internal state vector;
- setpoint error;
- endogenous drive;
- internal action motivations;
- verified-only trait adaptation;
- slow verified setpoint adaptation;
- causal projection to policy selection;
- persistence/restart;
- holdout and counterfactual tests.

## NOT CLAIMED

- phenomenal consciousness;
- biological-equivalent neural circuitry;
- genuine human-like emotions;
- physical Android operation without physical-device evidence.
