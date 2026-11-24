# BIG PASS 64 — Verification

## Автоматические проверки
- TypeScript runtime typecheck — должен быть `PASS`.
- `BIG_PASS_64_EXTERNAL_OBSERVER` — проверяет действие, внешнее наблюдение, verification, causal evidence и restore.
- `BIG_PASS_64_EXTERNAL_OBSERVER_ADAPTERS` — проверяет filesystem и process observers без сетевой зависимости.
- `audit:big-pass-64` — проверяет архитектурное внедрение и release metadata.

## Семантические гарантии
- `ok=true` не считается независимым внешним подтверждением.
- External verification использует observationId и source-independent boundary.
- Unknown не превращается автоматически в verified.
- Contradiction повышает pressure, а не переписывает мир без подтверждённого контекста.
- Causal autobiography является наблюдаемым audit-derived представлением, а не доказательством субъективного опыта.

## Ограничения
Read-only adapters дают наблюдение инфраструктуры, но сами по себе не создают аппаратного sensorium. Реальная Android квалификация и 1000-cycle long-horizon остаются отдельными device-gated задачами.
