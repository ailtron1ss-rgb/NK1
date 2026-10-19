# Neuro-Kurisu 34.31.0

## BIG PASS 60 — Learned World Model + Unified World Fabric

### Главное
- World cognition собран в единую систему на базе `WorldSubsystemRuntime`.
- Perception/grounding/P27/WorldModel2/residual prediction теперь имеют единый путь интеграции.
- Добавлено реальное passive transition learning.
- Action-conditioned world learning централизован.
- Action candidate world evaluation централизован.
- Model disagreement теперь является сигналом cognitive uncertainty/pressure.
- Исправлено ложное обучение переходам из-за изменения только `tick`.
- Core больше не должен вручную склеивать P27/WorldModel2/residual/rollout.

### State compatibility
State schema остаётся **92**: новый координатор использует состояние уже существующих world models и не создаёт новый обязательный persisted branch.

### Verification
- Typecheck: PASS
- World Fabric regression: PASS
- Core world-loop regression: PASS
- P27/P42/P44 relevant regressions: PASS
- Restart/smoke: PASS

### Ограничения
Это не полноценный neural world model человеческого класса. Реализация представляет собой bounded online learning scaffold, предназначенный для постепенного перехода к обучаемым representations при мобильном бюджете.
