# NEURO-KURISU — Portable Subject Boundary 34.1.0

## Назначение

В 34.1.0 добавлен явный контракт переноса **субъекта** между хостами. Он не доказывает личность или сознание; он делает проверяемой инженерную границу, в которой идентичность, память, развитие и внутренние модели принадлежат субъекту, а устройство, capability и embodiment остаются локальными.

## Что переносится

`state`, `goals`, `traces`, `memories`, `worldModel` и subject-фасеты `memory`, `learning`, `consciousness`, `evolution`, `cognition`, `advanced`.

## Что не переносится

`facets.embodiment`, host capabilities и runtime-specific system state. Поэтому камера, микрофон, TTS/STT, battery/thermal state и конкретный host не объявляются частью идентичности.

## Целостность

Bundle использует SHA-256 fingerprint канонического subject projection и протокол `neuro-kurisu.subject-transfer.v1`. Изменение содержимого bundle без пересчёта fingerprint отклоняется.

## Ограничение доказательства

Проверка fingerprint доказывает целостность конкретного экспортированного состояния, но не доказывает метафизическую тождественность личности и тем более не доказывает сознание. Transfer continuity остаётся отдельной эмпирической задачей: restart, model-switch, host-switch, long-horizon и внешняя оценка.

## CLI

```bash
npm run subject:export -- <state.json> [portable-subject.json]
```
