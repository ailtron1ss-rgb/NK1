# Оставшиеся задачи после WorkPass61

## P0 — execution truth / crash-recovery на реальном транспорте

- [x] Append-only revision для authoritative provider-found receipt при уже существующем execution ID.
- [x] Сохранить исходную OCF запись и исходную CEF action/outcome/evidence-тройку; revision — отдельный node/event.
- [x] Повтор той же квитанции дедуплицируется; изменённый fingerprint при той же receipt identity отклоняется.
- [ ] Выполнить реальный provider/device side effect и независимое read-after-write postcondition.
- [ ] Убить процесс в промежутке после side effect/перед receipt, восстановить из durable state и проверить отсутствие повторного исполнения.
- [ ] Проверить все реальные bridges (voice, camera/device, outbound, browser/research, compound skill/project) на единый gateway/finalizer и одни IDs.

## P1 — память/агентность/воплощение

- [ ] Независимый русско-английский temporal retrieval holdout с hard negatives; текущий broad `recallDelta=0`, кандидат не promoted.
- [ ] Доказать end-to-end обновление interest/initiative только от подтверждённых событий с idempotent event IDs.
- [ ] Production browser/Live2D journey: approve, continue original request, cancel/interrupt, reconnect, error/degraded UI.
- [ ] Voice timeline, visemes, gesture/look/posture synchronization against same runtime state.

## P2 — переносимость и релиз

- [ ] Измерить local inference на целевой GTX 1650 4GB host (VRAM/RAM, context, concurrency, latency, token throughput, quality).
- [ ] Clean-room crash restore/rollback; проверка manifest и persistence migration на нескольких предыдущих schema fixtures.
- [ ] Ручной license/provenance review всех ещё потенциально полезных файлов из вложенных source archives.
- [ ] Endurance soak и сбор recovery, idempotency, memory latency, disk/RAM metrics.

## Счётчики

- WorkPass61 code scope: **8/8 = 100%**.
- Overall weighted roadmap: **79.3%**. Доля увеличена с 78.8% на 0.5 п.п. только за закрытый code-level receipt-revision/integration gap; live device/provider/restart gates остаются открытыми.
- Normalized inventory: **78 total; 60 DONE / 10 PARTIAL / 8 TODO**.
