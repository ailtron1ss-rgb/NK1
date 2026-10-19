# Neuro-Kurisu 34.21.0 — BIG PASS 50
## Cognitive Frame + Compiled Execution Plan + verification semantics

### Цель
Не добавлять очередной декоративный P-слой, а сделать существующий cognitive spine более единым, дешёвым и измеримым на среднем Android/Termux.

### Реально внедрено

1. `CognitiveFrame` — компактное нормализованное представление текущего цикла: сигнальная маска, dirty-domains, prediction error, novelty, uncertainty, ресурсные ограничения, сложность и ожидаемый информационный выигрыш.
2. `CognitiveExecutionPlanner` — компилятор execution-плана поверх уже существующего `CognitiveSpineScheduler`. Он не мутирует cognition и не дублирует scheduler.
3. Дополнительная domain/cadence/resource gating для perception, memory, world-rollout, research, shadow, project и slow-cognition.
4. Накопительная статистика runs/skips/forced/opportunities/savings для планировщика, чтобы эффективность можно было измерять, а не предполагать.
5. Состояние execution planner сохраняется в `system.cognitiveExecutionPlan` и восстанавливается после restart.
6. `observe()` больше не делает deep `structuredClone` всего `OrganismState` ради `stateBefore`: state содержит только небольшую собственную структуру и теперь копируется целенаправленно по полям/`needs`.
7. Tool result разделён семантически на `ok` (исполнение запроса прошло) и `verified` (tool явно предоставил verification contract). Для built-in read tools contract объявлен явно.
8. Release/source-of-truth синхронизирован с `34.21.0`.
9. BIG PASS 50 regression test зарегистрирован в npm scripts.

### Что намеренно НЕ заявляется

- это не доказательство сознания;
- это не learned world model;
- это не полноценная semantic vision system;
- это не native Android lifecycle host;
- это не подтверждение 24/72/168h реальной работы на физическом телефоне.

### Проверки

- typecheck: PASS
- architecture audit: PASS
- integrity audit: PASS
- source-truth audit: PASS
- hygiene: PASS
- BIG PASS 45 performance regression: PASS
- BIG PASS 49 subsystem/runtime/DAG: PASS
- BIG PASS 50 execution planner regression: PASS
- P31/P32 lesion: PASS
- P42-P44 integration/truth/performance/persistence: PASS
- P69-P73 persistence: PASS
- P74-P77 integration: PASS
- P80-P82 integration/runtime E2E: PASS
- persistence projection/footprint/hotpath: PASS
- 250-cycle operational horizon: PASS

### Интерпретация
Главный результат прохода — переход от единственного cadence-controller к двухслойному execution policy:

`observation → CognitiveFrame → existing Spine decision → compiled operation plan → existing cognition`

Это сознательно сделано без второй параллельной архитектуры. Следующий крупный шаг должен использовать этот слой для реального extraction `Self/World/Memory/Embodiment/Agency/Development/Governance`, а затем подключить learned representations и реальный multimodal grounding.
