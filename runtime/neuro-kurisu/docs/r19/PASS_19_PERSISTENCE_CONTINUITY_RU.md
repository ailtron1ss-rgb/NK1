# PASS19 — Persistence/Continuity

Корневая release note: `RELEASE_NOTES_PASS_19_PERSISTENCE_CONTINUITY_2026-10-01_RU.md`.

PASS19 добавляет durable projections для P49/P56/P59/P62/P63/P66/P68 и исправляет передачу P48/P49 в `SelfSubsystemRuntime.restoreFromPersisted()`. Ключевая regression: P49 journal hash сохраняется через restart.
