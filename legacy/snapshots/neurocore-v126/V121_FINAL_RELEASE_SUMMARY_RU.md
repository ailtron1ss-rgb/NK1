# NeuroCore V121 — Final Release Summary

## Реально сделано

- Исправлен adaptive compute: deep refinement вычисляется только для выбранных строк batch; min/max deep fraction реально соблюдаются.
- Исправлена семантика event-bank: explicit `credit_key` теперь сохраняется как ключ события и используется для последующего routing.
- `state_activation_mode` больше не декоративный параметр: candidate heavy-tail activation действительно подключается к recurrent hidden path.
- Добавлен isolated input-dependent channel decay candidate без изменения default trunk.
- Добавлены execution-level, routing-key, activation, parameter-count и checkpoint tests.
- Current version поднят до `v121-foundations` / package `1.21.0`; schema 20 сохранён для совместимости.

## Quality gates

- 63/63 current tests PASS
- compileall PASS
- verify_current PASS
- checkpoint round-trip: 108/108 tensors, 0 missing, 0 shape mismatch, 0 unexpected
- 69 137 default parameters, все trainable
- 1 canonical recurrent owner
- 0 duplicate state keys
- 0 legacy imports in current path
- 53 explicit mechanisms/candidates in upstream catalog

## Что показали эксперименты

- Adaptive branch: controlled execution 25% selected rows. На CPU batch 64 sparse path был ~1.42× медленнее dense; на batch 256/512 стал быстрее (~0.67×/0.62×), то есть dispatch overhead зависит от масштаба.
- Three-seed short training: loss снизился примерно на 7–9% за 20 шагов на каждой проверенной инициализации.
- Input-dependent token decay: net gain не доказан; оставлен candidate-only.
- Delayed credit: направление часто сохраняется, но amplitude retention остаётся слабым; delay 128 всё ещё практически теряется.

## Статус

V121 — не финальный NeuroCore. Это корректирующий/фундаментальный проход, который делает current path честнее и лучше подготовленным к V122: unified sparse-associative memory, long-horizon retention, interference/capacity и hardware-aware execution.
