# P2855 — Contextual Action Policy / 35.26.0

## Цель
Перевести иерархическую slow-memory из преимущественно memory/retrieval роли в реально проверяемый контекстный контур выбора действия, не увеличивая runtime-memory пропорционально размеру основного neural substrate.

## Реализация
- Добавлен `src/organism/cognition/P2855ContextualActionPolicyController.ts`.
- Фиксированная память: 8 контекстов × 16D prototypes + 8×7 action values + visit counters.
- Контекст выбирается по явному context id с nearest-prototype fallback для уже виденных контекстов; новый контекст не поглощается чужим prototype.
- Action bias рассчитывается из выученных context values и ограничен bounded gain.
- Outcome learning использует reward advantage, prediction error, verification и device budget.
- Wake/quiet/sleepRecent/sleepPrior/transfer имеют разную plasticity scale.
- Policy состояние сохраняется через `NeuralExperienceBranch` snapshot/restore.
- Добавлена отдельная ablation запись `contextualActionPolicy`.
- Policy используется в live decision path непосредственно перед workspace/арбиторной агрегацией.

## Проверка
Controlled controller benchmark:
- training reward: 0.9103
- independent holdout action accuracy: 1.0
- context-0 retention: 1.0
- updates: 1200
- estimated policy memory: 1760 bytes / 1.72 KB

Integrated organism benchmark:
- 84 cycles
- 84 policy updates
- persistence: true

Policy ablation on full `NeuralExperienceBranch`:
- policy ON action accuracy: 0.2667
- policy OFF action accuracy: 0.1667
- absolute gain: +0.1000
- policy updates: 180

## Ограничения
Это не доказательство общего интеллекта, сознания или биологической эквивалентности. Controlled benchmark показывает функциональную обучаемость контекстной policy, но integrated organism accuracy всё ещё низкая; контур требует дальнейшего усиления через arbitration, long-horizon transfer и task-success benchmarks.
