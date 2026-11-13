# Will → NK1: bounded voluntary attention effort

## Источник и переносимая идея

В архивном Will найден реализованный двухслойный механизм: involuntary vitals ceiling + voluntary effort. Исполнительные действия повышают engagement при исследовании/проверке/размышлении или снижают его при отдыхе/ожидании. Effort не может превысить ограничение, заданное энергией, бодрствованием и физиологическим стрессом; без нового сигнала он постепенно возвращается к домашостатическому baseline 0.7.

NK1 уже имеет `CognitiveResourceEconomy`, который владеет общим compute/attention budget. Поэтому новая отдельная AttentionAllocator не создаётся. Механизм адаптирован внутрь этого владельца.

## Реализация

- `explore`, `verify`, `reflect` → voluntary intent `engage`, effort target 1.0.
- `rest`, `wait` → intent `rest`, effort target 0.4.
- Остальные действия → постепенное расслабление к baseline 0.7.
- `engage` запрещён при energy ≤ 0.15, `awake=false` или thermal strain ≥ 0.85. В этом случае target возвращается к 0.7, а общий ресурсный потолок всё равно остаётся ограничен исходной физиологической оценкой.
- Итоговый attention allocation = прежний resource ceiling × effort; effort никогда не повышает общий budget и не может выйти за [0.4, 1.0].
- Effort/target/intent сохраняются в snapshot; старые version-1 snapshots восстанавливаются с baseline 0.7.

## Подключение

`OrganismRuntime.step()` и `sampleEmbodiment()` читают последний канонический `ActionKind` и передают intent в `CognitiveResourceEconomy.allocate()`. Диагностический event resource дополнен текущим effort и его intent.

## Проверки

- `test:cognitive-resource-economy` — сохранение старых restore invariants.
- `test:will:voluntary-attention-budget` — engage/rest/homeostasis, action mapping, vitals veto, backward-compatible restore, malformed effort clamping.
- `nk1-unified-organism-runtime.yml` запускает оба теста и typecheck.

## Ограничения

Это адаптация механизма распределения внимания, а не копия Will runtime. Она не создаёт отдельный focus action и не изменяет физический energy-decay law: внимание ограничивается уже существующими energy/awake/thermal signals. Отдельная стоимость sustained focus через EnergyRegulator требует отдельного измеренного изменения, а не предположения, что увеличенный attention budget автоматически расходует энергию.
