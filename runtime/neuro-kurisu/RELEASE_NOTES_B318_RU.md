# BIG PASS B318 — Durable Process Restart

Дата: 2026-09-14
Версия проекта: Neuro-Kurisu 35.6.1 → B318

## Цель

B317 доказал, что когнитивная цепочка может продолжаться после восстановления из `MemoryStateStore`. B318 закрывает следующий более сильный контракт: состояние должно пережить **реальную границу процесса** и после запуска нового Node-процесса организм должен продолжить обучение, cognitive closure и действие.

## Что добавлено

- `tests/big-pass-318-durable-process-restart.mjs`
- `tests/big-pass-318-process-worker.mjs`
- `npm run test:big-pass-318`
- `npm run audit:reality-fast`

## Контракт B318

```text
process A
  → OrganismCore
  → observe
  → feedback
  → learning
  → cognitive closure
  → flush()
  → FileStateStore.save()
  → process exit

process B
  → FileStateStore.load()
  → OrganismCore.init()
  → восстановление состояния
  → новый observe/feedback
  → learning продолжает расти
  → cognitive closure продолжает расти
  → flush()
```

## Реальный результат

- durable state file: ~1.84 MB
- process A и process B получили разные PID; конкретные PID зависят от запуска
- tick до restart: 3
- tick после продолжения: 4
- learning updates до restart: 3
- learning updates после продолжения: 4
- cognitive closure cycles до restart: 3
- cognitive closure cycles после продолжения: 4
- synaptic updates до restart: 468
- durable store load: PASS
- реальная граница процессов: PASS

## Что это доказывает

Это существенно сильнее простого `snapshot()`/`structuredClone()` теста. B318 использует реальный `FileStateStore`, создаёт новый Node-процесс и заставляет новый `OrganismCore` загрузить сохранённый JSON с диска.

## Что всё ещё НЕ доказано

B318 не доказывает физическую гарантию переживания внезапного отключения питания в середине записи. Это будет отдельный этап crash-injection / corruption-recovery testing.

Также B318 не является доказательством сознания или человеческой эквивалентности.

## Следующий большой кирпич

B319: crash-injection persistence — принудительное завершение процесса в разные моменты checkpoint/write pipeline, проверка backup recovery, corruption detection, loss window и сохранности личности/learning после аварийного восстановления.
