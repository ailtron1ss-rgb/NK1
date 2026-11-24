# P2688 — Causal Replay Credit Assignment

Статус: research-release.

## Реализовано

- `CausalReplayCreditAssigner` добавлен в Experience Continuum.
- Delayed validation теперь может быть причинно привязана к конкретному replay event.
- Реализован каскад eligibility traces: 12 часов / 3 дня / 14 дней.
- Credit использует retention gain, transfer potential, interference risk, learning opportunity и priority.
- Evidence сохраняется в bounded ledger и восстанавливается после restart.
- `OrganismCore` получил diagnostics и ledger accessors.
- State schema поднята 195 → 196.
- Версия приложения: 35.6.88.

## Доказательства

- causal replay test: PASS.
- 320-cycle long-horizon: PASS; 65 replay events, 32 delayed independent validations, 32/32 credit assignments.
- migration 195 → 196: PASS.
- policy ablation P2687: PASS.

## Ограничение

Causal credit оценивает атрибуцию вычислительной replay-системы; это не доказательство биологического consciousness и не гарантия причинности внешнего мира.
