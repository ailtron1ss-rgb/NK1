# Release Notes B333 — Autonomous Goal Genesis Reality Gate

## Добавлено
- `B333AutonomousGoalGenesisGate`
- goal-origin provenance ledger
- internal/external goal-source accounting
- restart-persistent B333 diagnostics
- B333 regression test

## Исправлено
- B327 regression harness обновлён под B332 semantics: repeated matched evidence одного boot обновляет существующий episode без создания duplicate episode.
- B332 live repeated test теперь проверяет и документирует safety boundary вместо ложного требования `matchedTrials>=3` при естественно меняющемся context/action.

## Verification
- typecheck PASS
- integrity PASS: 2572 files
- syntax PASS: 824 JS / 5 SH / 203 JSON
- release contract PASS
- B327–B332 regression PASS
- B333 unit PASS
- B333 live Core PASS

## Не заявляется
- полноценная long-horizon autonomous motivation
- autonomous project completion
- consciousness
- real Android embodiment
