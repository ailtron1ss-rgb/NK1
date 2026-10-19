# P20 — Temporal Continuity / Local-Native Final Gate

Дата: 2026-08-27
Версия релиза: 7.0.0
Organism Core: 17.0.0-p20-temporal-continuity-final-gate
State schema: 23

## Главная цель

P20 завершает фундаментальную дорожку P15.5→P20. Организм получает календарное и процессное чувство времени, устойчивое возобновление после остановки Termux/процесса, bounded recovery после длительного отсутствия и отдельную проверку 24/72/168 часов.

## Persistent-time принцип

Организм не обязан симулировать каждый пропущенный цикл. При повторном запуске он:

1. читает последний сохранённый checkpoint;
2. вычисляет реальное время отсутствия;
3. классифицирует промежуток (секунды/минуты/часы/дни/недели/месяцы/годы);
4. фиксирует temporal-gap и session event;
5. обновляет календарный контекст;
6. продолжает работу с тем же состоянием.

Это позволяет остановить Termux на 5 минут, 100 часов или 100000+ часов и не требовать ручного ввода времени. Ограничения находятся не в арифметике Date/Unix time, а в политике хранения/развития; она остаётся bounded и не генерирует 100000 часов искусственных cognition cycles.

## Большие изменения

- `TemporalContinuityEngine` — persistent session/gap/calendar model.
- schema 22→23 migration.
- session start/end + temporal-gap events.
- chat/API возвращают current time и continuity context.
- graceful shutdown сохраняет закрытие сессии.
- abrupt process kill определяется по незакрытой предыдущей сессии.
- bounded event/trace/memory retention сохраняется.
- P20 temporal regression test с многодневным gap.
- Device Gate оставлен как physical validation: 24h → 72h → 168h.

## Android reality

Текущий canonical runtime по-прежнему Termux/Node. Это не заменяет native Android lifecycle. Android может завершить cached process; длительная работа должна опираться на поддерживаемые lifecycle APIs, а не на предположение о бессмертии процесса. Для будущего native host рекомендуется использовать сервис/WorkManager в зависимости от характера работы и не делать dataSync foreground service бесконечным.

## Критерий готовности фундамента

P20 считается архитектурно завершённым, когда:

- persistent time работает после clean restart;
- persistent time восстанавливается после abrupt process death;
- 100000+ hour gap не порождает 100000+ cycles;
- calendar context корректен при каждом новом запуске;
- state schema migrates 22→23;
- 24/72/168h physical tests пройдены на целевом устройстве;
- релизные manifests/audits чистые.

## Далее

Обязательных фундаментальных этапов после P20 нет. Дальше — только capability branches и физическая валидация. Источник истины для следующих версий: `docs/VERSION_LEDGER_RU.md`, `docs/EVOLUTION_HANDOFF_RU.md`, этот файл и результаты Device Gate.
