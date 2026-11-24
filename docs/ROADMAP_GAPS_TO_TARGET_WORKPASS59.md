# Neuro Kurisu — оставшиеся разрывы после WorkPass59

## P0 — кодовый приоритет следующего прохода

1. **Durable resume составного действия:** сохранить current step/cursor, operation key, decisionId, executionId, approvals, receipt references и work product одним атомарно восстановимым checkpoint. После рестарта продолжать с теми же идентификаторами.
2. **Ambiguous receipt reconciliation:** если процесс падает после возможного внешнего эффекта, запрещать blind retry; сначала запросить авторитетный receipt у адаптера или возвращать `reconciliation-required`. Не переинтерпретировать timeout/unknown как отказ без эффекта.
3. **Exactly-once causal projection per execution:** action/outcome/history/learning projection должны идемпотентно связываться одним execution ID и не дублироваться после resume.
4. **Пути, которые требуют реального adapter E2E:** device, outbound, voice, browser/research bridge, project executor и compound skill; проверить permission pause/resume, неуспешное одобрение, рестарт и postcondition.

## P1 — память и обучение

- Создать frozen independently labelled retrieval set и сравнить BM25/hybrid/vector на Recall@k, MRR/nDCG, temporal accuracy, false recall, abstention, latency and cost. Текущий доступный baseline `recallDelta=0 / not-promoted`; улучшение не заявлять без числа.
- Проверить delayed external observations после рестарта; сохранить provenance, source identity/independence key и supersession.
- Не изменять личность/навык по симуляции, policy refusal, неизвестному outcome или повторному наблюдению.

## P1/P2 — интерфейс и локальный runtime

- Установить app dependencies и выполнить production Vite build, browser E2E и интерактивный Live2D/voice timeline test. Browser-smoke contract не равен реальному E2E.
- Измерить целевую локальную модель на GTX 1650 4 GB: VRAM/RAM, cold start, throughput, context, latency and answer quality.
- Проверить rollback в чистом окружении, вложенные источники/licensing и длительный soak.

## Проценты

- WorkPass59: 6/6 deliverables = **100% выполнения текущего прохода**.
- Общая взвешенная дорожная карта: **78.0%**, без изменения; ни один live provider/device или production E2E gate этим проходом не закрыт.
