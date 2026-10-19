# Neuro-Kurisu 35.30.0 — PASS 08

## Persistence / mobile checkpoint

Добавлен content-addressed deduplication в `FileStateStore`: одинаковый сериализованный payload не записывается повторно, пока state-файл существует. При внешнем удалении файла следующая запись выполняется нормально.

Новый тест: `tests/p2869-durable-checkpoint-dedup.mjs`.

Статус: implementation + targeted evidence PASS. Физический Android benchmark не заявляется.
