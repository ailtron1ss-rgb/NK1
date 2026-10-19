# P7 — Changelog

## Версия 4.1.0 / Core 7.2.0-p7 / Schema 9

### Добавлено
- Cognitive Network Bus: specialist competition, inhibition, ignition, recurrent cycles, broadcast.
- Functional Neuromodulation: exploration/exploitation, attention gain, update rate.
- Semantic Memory Graph: nodes/edges, associative retrieval, persistent graph facet.
- P7 causal research lab: network, neuromodulation и semantic-memory lesions.
- Identity-lock integration test.
- Concurrency, replay и UI/API smoke tests.
- Локальный 2D viewer `/avatar.html`.
- `/api/organism/inspect` и `/api/organism/avatar`.
- UI dashboard для state/network/neuromodulation/memory/evolution.
- Автоматический `audit:brain`.

### Исправлено
- Старая P1-подстановка удалена из cognitive prompt.
- UI больше не читает несуществующие поля старого status contract.
- Static GET теперь возвращает 404 на отсутствующий файл.
- Release contract синхронизирован: 4.1.0 / 7.2.0-p7 / schema 9.
- Старые P6/4.0.1 текущие документы перенесены в history.
- UI smoke теперь проверяет actual dashboard и avatar viewer.

### Принцип
Каждый новый компонент подключён в organism cycle; нет decor-only cognitive modules.
