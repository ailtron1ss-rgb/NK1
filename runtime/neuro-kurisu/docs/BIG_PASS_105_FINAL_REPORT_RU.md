# NEURO-KURISU — BIG PASS 105
## Experimental Protocol + Evidence Gate Extension

Дата: 2026-09-08
Release: **34.79.0**
State schema: **114**

### Цель
Перевести контур replay/retention/transfer из режима «есть метрики» в режим «метрики допускают только тот вывод, который поддержан экспериментальным дизайном».

### Сделано
1. Добавлен `ReplayExperimentProtocol` с явным описанием randomization, balance, required matched pairs и контекстов.
2. Добавлен `replayExperimentProtocolCheck()`, который различает exploratory/matched и confirmatory-eligible состояние.
3. Добавлен `replayEvidenceLedger()` для трассировки validated retention → replay event → evidence key.
4. Добавлен `memorySkillEvidence()` для контролируемого запроса memory↔skill evidence.
5. Добавлены `transferMatrix()` и `transferInferenceGate()` для раздельного учёта положительного/отрицательного transfer и минимального holdout/context diversity.
6. Core получил публичные методы для протокола и transfer diagnostics.
7. Migration сохранена совместимой для schema 113 → 114; новые protocol records являются bounded и опциональны.
8. Добавлен автоматический `experimental-protocol-audit`.

### Что намеренно не утверждается
- Replay не считается автоматически биологической консолидацией.
- Synthetic benchmark не считается доказательством эффекта на реальном агенте.
- Confirmatory inference запрещается, если protocol/trials не удовлетворяют gate.
- Consciousness claim не изменялся.

### Проверки
- Typecheck: PASS
- Pass 100–104 regression: PASS
- Pass 105 functional: PASS
- Pass 105 migration: PASS
- Experimental protocol audit: PASS
- Mobile 1000: PASS
- Operational 500: PASS
- Architecture/contract/source-truth/integrity/hygiene/forensics/ownership/project-state/conflicts: должны быть PASS перед release packaging.
- Operational 1000: не засчитывается без завершённого запуска.
