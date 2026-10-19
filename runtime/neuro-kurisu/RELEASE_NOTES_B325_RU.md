# Neuro-Kurisu 35.6.1 — B325 Release Notes

## Recovery → Autobiography → Self-Model

B325 связывает инфраструктурное восстановление с внутренней непрерывностью организма.

### Main changes

- Добавлен `recovery` event type.
- Recovery event связывает previous/current boot, ticks, learning counts и recovery reason.
- Исправлен `RecoveryWatchdog.bootId`: restore больше не подменяет identity нового runtime старым boot id.
- Добавлен `previousBootId`.
- `SelfModelV2` теперь хранит recovery count, continuity shock и post-recovery integration.
- Добавлен `SelfModelEngine.registerRecovery()`.
- Recovery создаёт autobiographical narrative episode `recovery-after-process-gap`.
- Добавлен `recoveryAutobiographicalSnapshot()`.

### Verified

- B325 direct integration: PASS
- B324 watchdog regression: PASS
- B324 core watchdog regression: PASS
- B323 process kill/resume regression: PASS
- syntax-check changed TypeScript sources: PASS

### Not falsely claimed

Full TypeScript compiler check was not completed in the execution budget and is therefore not marked PASS.

## Architectural meaning

Recovery is now represented simultaneously at three levels:

1. runtime continuity;
2. autobiographical continuity;
3. self-model adaptation.

This prepares B326, where recovery history must be shown to alter subsequent behavior rather than merely being recorded.
