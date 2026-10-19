# Neuro-Kurisu 35.6.1 — BIG PASS 324
## Recovery Watchdog / Self-Aware Process Recovery

Дата: 2026-09-14

### Цель
B324 закрывает следующий разрыв после B323: организм должен не только переживать process kill, но и иметь отдельный машиночитаемый recovery-контур, который различает нормальную работу, stale heartbeat и recovery/resume.

### Реализовано
- `src/organism/persistence/RecoveryWatchdog.ts`
- интеграция состояния watchdog в `OrganismCore.system.recoveryWatchdog`
- восстановление watchdog через `StateMigrations`
- обновление heartbeat на checkpoint
- публичный `recoveryWatchdogSnapshot()` для наблюдения
- тесты `tests/big-pass-324-recovery-watchdog.mjs` и `tests/big-pass-324-core-watchdog.mjs`
- npm scripts `test:big-pass-324` и `test:big-pass-324:core`

### Поведение
Watchdog имеет состояния `healthy | stale | recovered` и хранит:
- bootId;
- lastHeartbeatAt / lastCheckpointAt;
- lastTick;
- lastLearningCount;
- recoveryCount;
- lastRecoveryReason;
- staleAfterMs.

При новом process init persisted watchdog восстанавливается с увеличением `recoveryCount`, после чего checkpoint возвращает его в `healthy`.

### Проверка
Standalone B324:
- stale detection = PASS
- restore = PASS
- tick restoration = PASS
- learning restoration = PASS
- resumed heartbeat = PASS
- explicit recovery transition = PASS

Core B324:
- durable watchdog state survived real OrganismRuntime restart = PASS
- recoveryCount 0 -> 1 = PASS
- restored tick/learning remained identical = PASS
- post-recovery state returned to healthy = PASS

Typecheck = PASS.

### Важное ограничение
Полный объединённый regression aggregate в этой среде снова оказался слишком тяжёлым и достиг runtime timeout. Это НЕ считается PASS и НЕ считается дефектом организма автоматически. Отдельные B324 gates прошли. B155/operational hardening ранее проходили; после B324 не объявляется новый полный aggregate PASS без завершённого прогона.

### Архитектурный эффект
B323 доказал `kill -> process resume`.
B324 добавляет следующий слой:
`heartbeat -> stale detection -> durable recovery state -> process resume -> recovery accounting -> healthy continuation`.

Следующий этап: B325 — связать recovery watchdog с autobiographical continuity и failure-recovery evidence, чтобы аварийное восстановление не только считалось инфраструктурным событием, но и становилось частью долгосрочного self/experience trace.
