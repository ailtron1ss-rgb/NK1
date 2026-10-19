# PASS 14 — Causal Life Graph hot-return

Дата: 2026-10-01

## Изменение

`CausalLifeGraph.recordCycle()` получил совместимый параметр `options.snapshot`. По умолчанию поведение прежнее: метод возвращает глубокий снимок состояния. В двух горячих точках `OrganismCore` результат вызова не использовался, поэтому они теперь передают `{ snapshot: false }` и не создают лишний полный снимок графа.

Это узкая оптимизация без изменения построения узлов/рёбер, порядка `recompute()`, формата сохранения или публичного поведения по умолчанию.

## Проверки

- `npm run typecheck` — PASS
- `npm run test:p34:personhood` — PASS
- `npm run test:smoke` — PASS
- `npm run audit:architecture` — PASS (1775 sourceFiles, 552 canonicalFiles, missing=0, cycles=0, legacyLeakage=0)
- `npm run audit:integrity` — PASS (3880 files)

## Ограничение

Это устраняет только неиспользуемый возвратный snapshot в двух callsites. Сразу следом Core всё ещё делает собственный durable snapshot графа; его перенос на checkpoint требует отдельной проверки границ сохранения и восстановления, поэтому здесь не менялся.
