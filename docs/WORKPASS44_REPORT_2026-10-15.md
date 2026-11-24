# WorkPass44 — большой интеграционный проход: внешние доказательства, идемпотентность и восстановление

**Дата:** 2026-10-15  
**База:** `Neuro_Kurisu_WORKPASS43_2026-10-15.zip`  
**Runtime:** 35.65.0 · **State schema:** 225  
**Тип прохода:** изменение исполняемого кода и его интеграционных путей, не release approval.

## Резюме

**Diff относительно WorkPass43:** 23 существующих файла изменено, 14 файлов добавлено (13 рабочих материалов/тестов и этот manifest изменений), 0 существующих файлов удалено; 9 089 базовых файлов остались побайтно неизменными. В работе с историей три старых байтовых версии закреплены в content-addressed blobs. Полный список: `docs/WORKPASS44_CHANGED_FILES_2026-10-15.json`.

WorkPass43 закрыл обход общего пути ActionGateway у автономного планировщика. WorkPass44 продолжает именно этот путь: закрепляет детерминированную идентичность исполнения на границе executor/provider, приводит семантику неизвестных исходов к правильной модели доказательств, связывает внешние наблюдения с конкретными outcome-узлами в CognitiveEventFabric и предотвращает повторное начисление temporal credit, роста доверия, source reliability и P84 continuity при одинаковом observation ID. В MemoryFabric добавлен fail-closed механизм для команд, чьи точные записи вышли за предел 512 квитанций.

Ключевой инвариант — **не повторять side effect только потому, что локально не найден старый ответ**. Контекст теперь несёт детерминированный `executionId` и SHA-256-производный idempotency token. Если провайдер/устройство не поддерживает такую идентичность, контекст сам по себе не даёт exactly-once гарантии: при неоднозначном результате нужен запрос авторитетной квитанции или ручная reconciliation, а не слепой повтор.

## Реальные изменения

### 1. ActionGateway: идентичность исполнения и контекст для внешнего исполнителя
- Ключевой локальный запрос порождает стабильный `executionId`, связанный с хешем idempotency key, и передаёт executor контекст с `decisionId`, `autonomous` и provider-facing хешированным ключом.
- Этот ключ доступен адаптеру для передачи в API provider/device, но интеграция конкретных SDK должна явно его использовать. Текущие тесты доказывают локальную стабильность и запрет слепого повтора; не доказывают поведение внешнего сервера.
- Состояния pending/uncertain остаются reconciliation-required. Crash tests покрывают persistence failure до side effect, исключение после side effect, сбой finalizer, сбой коммита completed receipt и перезапуск.

### 2. Семантика неизвестного исхода
- Отсутствие внешней проверки больше не создаёт ребро `contradicted` и не превращается в отрицательный обучающий сигнал.
- Только явно подтверждённое несоответствие постусловию может сформировать противоречащее свидетельство. Неизвестно ≠ ложь; outcome ActionGateway остаётся неизменяемым, а позднее свидетельство добавляется отдельным уровнем.

### 3. Реальная интеграция external evidence → CEF
- `OrganismCore.ingestExternalObservation` использует точную пару execution/tool identity и связь с соответствующим `tool-outcome`.
- `CognitiveEventFabric` получает отдельный детерминированный узел `external-evidence`, родителем которого является исходный outcome; сохраняет observation ID, execution ID и hash-only представление фактов. Сырой текст постусловия не копируется в причинный граф.
- Точный повтор является replay/no-op; использование того же ID с другим фактом/хешем отклоняется. При restore ссылка сохраняется только если целевой узел существует и все ID/hash совпадают.

### 4. Предотвращение повторного обучения и инфляции доверия
- `CanonicalTemporalCreditAuthority`: outcomes имеют `outcomeId`/`decisionId`; replay не создаёт новые assignments и конфликтный reuse отклоняется. Ключи сохраняются snapshot/restore.
- `ExternalObserverFabric`: повтор уже обработанной оценки возвращает предыдущий assessment без второго increment source reliability/counters.
- `ExternalEvidenceTrust`: corroboration обновляется один раз на `evidenceId`; конфликтный identity reuse — ошибка.
- P84 autobiography/behavior continuity: повторные ingest и `learnFromVerifiedOutcome` не расширяют revision/sample history второй раз; idempotency keys переживают restore.
- P83 PersistentRealityModel: тот же observation ID не повышает belief confidence/continuity повторно.

### 5. Безопасность старых mutation receipts MemoryFabric
- Точный receipt journal остаётся ограниченным 512 записями. Для вытесненных ключей сохраняется компактный Bloom tombstone, чтобы старый command ID не мог молча повторно применить мутацию.
- Возможное совпадение с tombstone переводит операцию в recovery-required; это намеренный fail-closed компромисс. Ложноположительное совпадение может потребовать reconciliation, но не приводит к незаметному повтору. Повреждённая карта также блокирует новые неизвестные мутации, сохраняя точные ответы из hot journal.
- Миграция и restore не должны подменять повреждённое состояние пустой картой.


### 6. Восстановление byte-level истории после развития P83/P84/causal graph
После изменения `P83PersistentRealityModel.ts`, `P84AutobiographicalContinuityFabric.ts` и `CausalAccountabilityGraph.ts` проверки выявили, что эти живые пути использовались старым source-archive и historical-snapshot manifests как точные байтовые источники. Вместо отката новых интеграций созданы три content-addressed blob-файла из проверенного WorkPass43 архива и 12 manifest refs закреплены на точных старых байтах. Повторные проверки вернули зелёное состояние: 8,512/8,512 компактированных членов и 10,427/10,427 исторических snapshot записей; 18,935 refs проверены. Это сохраняет новый active source и воспроизводимость старой истории одновременно.

## Проверки, проведённые по компонентам

| Область | Результат | Что именно доказывает |
|---|---|---|
| Runtime typecheck | PASS | Проверка типов TypeScript runtime в текущем дереве |
| Receipt/CEF integration | 9/9 PASS | Действие, outcome, evidence, exact parent и replay через реальный OrganismCore путь |
| Evidence/replay/retired receipt | PASS | unknown-vs-contradicted, exact IDs, CEF restore, temporal credit, observer/trust/P84 replay, tombstone safety |
| Crash reconciliation | PASS | Pre-effect gate, ambiguous post-effect, finalizer/persist error, restart replay, key conflict |
| Memory lifecycle | PASS | Канонический MemoryOS2 владелец, exact receipt journal, replay event delta 0 |
| Action ledger archive | 4/4 PASS | Архивная идемпотентность и восстановление |
| Deterministic causal graph | PASS | Детерминированный граф и связи |
| Reafference integration | 1/1 PASS | Существующий интеграционный сценарий решения, перезапуска и delayed assignment |

Результаты зафиксированы отдельно. `npm run audit:workpass44:focused` завершился PASS. При повторном запуске полного `npm run audit:workpass44` последовательность дошла до второго typecheck после нескольких наборов тестов, но не завершилась в доступном окне инструментального запуска; этот full aggregate не маркируется PASS. Runtime typecheck отдельно прошёл, как и focused aggregate. Доказательства не повышаются до уровня настоящего внешнего провайдера только на основании моков/локального исполнителя.

## Связь с Plants / syns / dous

- **Plants:** не добавлен второй runtime, второй memory writer или второй ActionGateway. История WorkPass43 сохранена в качестве исходной линии.
- **syns:** исправлена конкретная семантика неизвестного доказательства и replay; новые тесты покрывают не только имена API, но и конфликт идентичности/restore.
- **dous:** исполнение остаётся единой цепочкой ActionGateway → durable receipt → CEF → external evidence → temporal credit/trust/P84. Сохраняется требование подтверждать интеграцию на реальном provider/device.

## Общий прогресс проекта

- **Учет задач:** 120 пунктов: **94 DONE, 14 PARTIAL, 12 TODO**. Статусы означают закрытие технического пункта в указанном объёме; PARTIAL/TODO удерживают внешние/релизные доказательства открытыми.
- **Прогресс этого прохода:** 90% реализации по scope WorkPass44; оставшаяся часть — provider/device-side idempotency и внешняя delayed evidence chain.
- **Официальная взвешенная дорожная карта:** **78.0%**, изменение относительно предыдущей оценки **+0.0 п.п.**. Новые unit/integration тесты не являются доказательством установленной браузерной сборки, target hardware или внешнего провайдера, поэтому официальная оценка не повышалась.

## Открытые задачи следующего прохода

1. Протянуть `ToolExecutionContext.idempotencyKey` в каждый реальный provider/device адаптер и добавить авторитетный receipt lookup/reconcile после разрыва соединения.
2. Провести crash-инъекции в реальном хосте на границах provider accepted → disconnect → local persistence → restart.
3. Подтвердить delayed observation → CEF → reafference/temporal credit на реальном provider/device пути без двойного обучения.
4. Установить app-зависимости в подходящем окружении, выполнить Vite production build и интерактивный browser/Live2D/Legacy E2E.
5. Закрыть target-host inference, независимый labelled temporal retrieval holdout (current uplift 0; candidate not promoted), clean-room rollback, license sign-off и soak.

**Финальный вердикт WorkPass44:** существенное реальное усиление семантики причинных событий, защиты от replay/двойного обучения и восстановления мутаций памяти. Не release-ready: провайдерская идемпотентность, browser E2E и несколько release gates ещё не подтверждены.
