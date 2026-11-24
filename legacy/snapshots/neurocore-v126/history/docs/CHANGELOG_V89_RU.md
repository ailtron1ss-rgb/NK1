# V89 — Consolidation / Current Architecture

Дата: 2026-09-25

## Реальные изменения

- Новый `neurocore.current` composition root вместо дальнейшего VXX-наследования.
- `NeuroCoreCurrent` владеет измеренным V88-compatible engine через composition.
- Добавлен `MechanismRegistry`: новый механизм сначала candidate, затем проходит qualification и только потом становится integrated.
- Добавлены явные input/target contracts; target для sequence learning теперь проверяется как `[B,T-1,L]`.
- Добавлена собственная schema boundary для current checkpoints (`current_schema_version`, `engine_source_version`).
- Убран тяжёлый eager import всей исторической версийной цепи из `neurocore` root.
- Исправлен V88 gradient-spike: spike вычисляется относительно предыдущей EMA до её обновления.
- Default `pytest` теперь проверяет только current qualification gate; legacy tests остаются сохранёнными отдельно исторически.
- Добавлен `scripts/verify_current.py` для проверки current gate, ancestry и параметров.

## Что намеренно НЕ сделано

- Не удалены исторические VXX исходники.
- Не добавлены новые neural modules только ради номера V89.
- Не объявлена улучшенная continual-learning эффективность без внешнего qualification.
- V88-compatible backend пока остаётся измеренным reference engine; его полное flattening — Pass 90.

## Следующий проход

Pass 90: flatten measured engine, сохранив checkpoint migration и one-owner boundaries.
