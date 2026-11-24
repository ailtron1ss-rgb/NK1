# Neuro-Kurisu 34.28.0 — BIG PASS 57

## Главный результат
Вынесена persistence projection из `OrganismCore` в `PersistenceProjectionCoordinator`.

## Реальные изменения
- `OrganismCore` сокращён примерно с 3414 до 3185 строк.
- Полный hot/full projection mapping перенесён в отдельный coordinator.
- `projectionContext()` стал единой точкой передачи runtime owners в persistence layer.
- Добавлена локальная snapshot memoization только на время одного projection pass.
- `syncHot()` вынесен из Core.
- Исторический persisted schema 92 сохранён.
- Добавлен `BIG_PASS_57_PERSISTENCE_COORDINATOR` regression test.
- Добавлена команда `test:big-pass-57-projection`.
- Добавлен aggregate `audit:pass57`.
- Source-of-truth документы синхронизированы с 34.28.0.

## Что не изменялось намеренно
- Не выполнялся массовый event-sourcing rewrite.
- Не изменялась semantics identity/persistence contracts.
- Не объявлялась 1000-cycle device qualification PASS: текущий и контрольный 34.27.0 в этом окружении не завершаются в коротком окне.

## Проверки
- typecheck PASS
- architecture PASS
- physical ownership PASS
- release contract PASS
- source truth PASS
- source hygiene PASS
- syntax PASS
- BIG PASS 57 projection PASS
- BIG PASS 56 system fabric PASS
- BIG PASS 52 memory PASS
- BIG PASS 53 perception PASS
- BIG PASS 54 grounding PASS
- BIG PASS 55 pressure/world learning PASS
- restart persistence PASS
- persistence tiering/footprint/hotpath PASS
- 250-cycle PASS
- 500-warm PASS

## Следующий этап
Typed projection ports → diff/dirty projection → event-oriented persistence; затем learned world model 2 и shadow cognition.
