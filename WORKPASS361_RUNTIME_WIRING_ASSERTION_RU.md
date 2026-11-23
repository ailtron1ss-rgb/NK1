# NK1 WorkPass361 — исправление контракта runtime-wiring теста

- Причина ошибки на SHA `1c8a872c9537cddb9772e2e09a57497f4ef63721`: `UNIFIED_SUBSTRATE=PASS`, typecheck PASS, но runtime-wiring regression сравнивал импорт без `resolveUnifiedCognitiveResourceSignals`.
- Обновлена только ожидаемая строка импорта в тесте. Production-код не менялся.
- Нужно подтвердить новый exact-head WorkPass331, включая runtime wiring и restart persistence.
