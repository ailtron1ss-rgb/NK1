# NK1 Memory & Recall — инженерный gate и порядок доведения

**Дата:** 29 октября 2026 года  
**Рабочая база:** `workpass70-source`  
**Владелец канонической записи:** `MemoryOS2`, за единым mutation boundary `MemoryFabric`  
**Статус:** инженерный проход; внешний независимый recall uplift не заявляется без корпуса и отчёта.

## 1. Что обнаружено и изменено

### Обнаруженный риск восстановления

До этого прохода `MemoryOS2.restore()` принимал массив снимка и строил `itemIndex` по ID. Повтор ID оставлял несколько элементов в `state.items`, хотя `itemIndex.set(id, row)` мог указывать только на одну запись. Это создавало два разных представления канонической памяти: массив с дубликатами и индекс с последней по порядку записью.

Добавлена защита восстановления:

- записи без строкового непустого ID отбрасываются до построения индексов;
- пробелы вокруг ID нормализуются;
- одинаковый ID разрешается по временной актуальности, состоянию карантина, началу валидности, revision sequence, observedAt и createdAt, а не по порядку строк в snapshot;
- если равноправные по этим признакам записи с одним ID содержат противоречащие смысловые факты/lineage, выбранная для диагностики запись переводится в `quarantined` с `confidence=0` и не должна выдаваться как обычное воспоминание;
- `restoreDiagnostics()` возвращает только счётчики — число исходных/принятых строк, разрешённых повторов ID, отбрасываний malformed rows, срезанных по лимиту строк и конфликтов, отправленных в карантин. Тексты воспоминаний и пользовательские данные не раскрываются.

Новая регрессия: `runtime/neuro-kurisu/tests/memory-restore-duplicate-identity.mjs`.

## 2. Архитектурные инварианты

1. `MemoryOS2` остаётся единственным каноническим владельцем записываемых воспоминаний.
2. `MemoryFabric.applyLifecycleCommand(...)` — граница мутаций, квитанций и событий. Не обходить её в продуктивных путях.
3. Semantically derived indexes/embeddings — кэшируемые производные данные. Ошибка/таймаут embedding provider не должны ломать лексический recall.
4. Mem0 Platform/OSS — только opt-in адаптеры. Внешние кандидаты не становятся автоматически доверенными фактами или инструкциями; запись/удаление требуют отдельного разрешения.
5. Hexis в каноническую память вносит проверяемую provenance/lineage через bridge; переиспользование trace ID с другим payload не должно переписывать исходное доказательство.
6. Тесты на синтетических фикстурах — регрессии кода, но не доказательство качества памяти на независимых данных.

## 3. Порядок инженерной работы

### Gate A — целостность восстановления и mutation boundary

- Дубликаты ID, пустые/невалидные ID, превышение лимита 1600 строк.
- Одинаковый ID с разными ревизиями: независимость от порядка rows.
- Одинаковый ID и одинаковая ревизионная authority, но разные смысловые факты: quarantine + abstention.
- Повтор lifecycle command с тем же ID/payload: идемпотентность после restore.
- Повтор command ID с иным payload: hard conflict, без второй мутации.
- Forget/revise/attach-evidence: обновление canonical store и индексов без теневой записи.

**Критерий:** каждая каноническая запись имеет ровно один ID в snapshot и index; спорное состояние не участвует в обычном factual recall.

### Gate B — качество извлечения

- Прямые запросы на русском и английском.
- Перефразирование, склонения/морфология, опечатки и смешанные RU/EN запросы.
- Точные идентификаторы, числа и кодовые имена.
- Типизированный recall: autobiographical/profile, episodic, goal, procedural, causal.
- No-answer и нерелевантные distractors: правильный abstention.
- Непротиворечивость результата при разном порядке snapshot и после перезапуска.
- Отдельное измерение retrieval failure и answer/reasoning failure.

**Критерий:** все обязательные случаи классифицированы в отчёте; высокие salience/recency/emotion не заменяют evidence.

### Gate C — временная корректность и забывание

- Текущее воспоминание, историческое состояние `asOfAt`, истёкшее `validUntilAt`.
- Исправление факта создаёт lineage/supersession без незаметного уничтожения истории.
- Сильное противоречие, quarantine, unknown status и восстановление после рестарта.
- Forget/delete: запись не может вернуться из stale index, compatibility projection, Mem0 shadow result или snapshot replay.
- `FAMA`-подобная метрика stale-fact rate фиксируется отдельно от Recall@k.

**Критерий:** в запросе о текущем состоянии старые superseded records не отвечают как текущая истина; исторический запрос может получить старую запись только в корректном временном режиме.

### Gate D — semantic provider и ресурсные ограничения

- Корректность размерности, конечности, ненулевой нормы и количества векторов.
- Ошибка и timeout провайдера, invalid query vector, invalid document vector и stale content hash.
- Lexical fallback, retry backoff, отсутствие зависшего write path.
- Лимиты запросов/ответов, CPU, RAM, размер индекса, p50/p95 latency и восстановление холодного кэша.
- Учитывать отдельно warm/cold restore и coverage семантического индекса.

**Критерий:** provider fault не теряет доступный lexical recall; дефектный или устаревший вектор не входит в действующий индекс.

### Gate E — двуязычный независимый holdout

Использовать существующий runner:
`runtime/neuro-kurisu/tests/run-independent-bilingual-memory-holdout.mjs`.

Каждый корпус должен содержать immutable version/source hash, provenance, labeling protocol и проверенную SPDX-лицензию/LicenseRef. Язык примера задаётся разметкой, не определяется моделью. Train и holdout должны быть разделены по нормализованным запросам и не иметь дубликатов/утечек. Нельзя использовать тестовый синтетический корпус как независимое доказательство.

Для каждого языка отдельно действуют текущие минимальные требования WorkPass496: как минимум 2 train query, 8 отвечаемых holdout query и 2 неотвечаемых holdout query. Для оценки устойчивости использовать текущий протокол из пяти seeds (например, 11, 29, 47, 71, 101); эти seeds меняют bootstrap, но не обучают retrieval. Для promotion-eligibility требуются положительный practically meaningful recall uplift с нижней границей парного bootstrap выше нуля для RU и EN, MRR не хуже установленного non-inferiority gate и отсутствие ухудшения unsupported/abstention, invalid, stale, quarantined/future-result и resource metrics.

Отчёт должен фиксировать fingerprints корпуса, меток и retrieval configuration. Эксперимент не меняет живую память и не продвигает кандидата автоматически. Прохождение gate означает только допуск к независимому рассмотрению.

### Gate F — Mem0, Hexis и Letta

- Mem0 Platform/OSS только через адаптер с opt-in; провайдер доступен не значит cognitive recall включён.
- Проверить consent/scope, redaction, prompt injection treatment, ограничение числа результатов, timeout и local-first fallback.
- Записи Mem0 не превращаются автоматически в MemoryOS2; нет автоматического повторного ingest внешних candidate memories.
- Hexis source trace immutable по ID/fingerprint и time-bound; конфликтующая повторная запись не подменяет lineage.
- Letta policy — reference/governance-only в текущем контракте; не считать runtime интеграцию доступной без доказательства в исходном архиве.

**Критерий:** внешние интеграции улучшают recall только при явном разрешении и измеримом uplift, не нарушая единственности канонического владельца.

## 4. Проверочная команда

В `runtime/neuro-kurisu/package.json` добавлена команда:

```bash
npm run test:memory-acceptance
```

Она запускает typecheck и выбранные регрессии восстановления, контекста запросов, autobiographical recall, round-trip state, semantic vectors, MemoryFabric, grounded abstention, experiment harness, Hexis evidence bridge и Mem0 adapters. Для PR в `workpass70-source` добавлен workflow `.github/workflows/workpass-memory-recall-acceptance.yml`.

Это acceptance gate для изменений кода. Он не подменяет независимый holdout с настоящей внешней разметкой; внешний набор не хранить в репозитории, если на него нет лицензии и права обработки.

## 5. Definition of Done

Память и recall можно считать инженерно готовыми лишь после выполнения всех пунктов:

- [ ] Runtime restore не допускает неоднозначные дубли ID к обычному recall.
- [ ] Повтор mutation command не создаёт повторный side effect после restore.
- [ ] Успешно проходят targeted tests и typecheck на exact PR SHA.
- [ ] Русский и английский holdout подтверждают полезное улучшение отдельно, без MRR/abstention/stale fact регрессий.
- [ ] Revision, supersession, contradiction и forget сохраняются через рестарт.
- [ ] Semantic provider failure оставляет lexical recall доступным.
- [ ] Mem0/Hexis проходят интеграционные проверки и не обходят canonical boundary.
- [ ] Профиль памяти укладывается в согласованные задержки и бюджет ресурса на целевом устройстве.
- [ ] Отчёт и Release ZIP привязаны к точному проверенному SHA; исторические PASS с другого SHA не засчитываются.

## 6. Ссылки

- [Рабочая база исходников](https://github.com/ailtron1ss-rgb/NK1/tree/workpass70-source)
- [MemoryOS2](https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts)
- [MemoryFabric](https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/runtime/neuro-kurisu/src/organism/memory/MemoryFabric.ts)
- [Двуязычные gate rules](https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/docs/WORKPASS496_BILINGUAL_MEMORY_RETRIEVAL_GATES_RU.md)
- [Протокол эксперимента retrieval](https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/docs/MEMORY_RETRIEVAL_EXPERIMENT_PROTOCOL_2026-10-10.md)
- [Hexis evidence lineage](https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/docs/WORKPASS509_HEXIS_TRACE_IDENTITY_AND_FUTURE_EVIDENCE_RU.md)
