# NK1 / NeuroCore — расширенный инженерный проход: память и Recall

**Дата:** 30 октября 2026 года  
**Рабочая ветка:** `work/memory-recall-closure-2026-10-29`  
**База PR:** `workpass70-source`  
**PR:** #389 (draft; не слит)  
**Область:** восстановление памяти, доверие к фактам, поиск и оценка recall.  
**Ограничение доказательств:** все прогоны в этом проходе — кодовые регрессии и синтетические фикстуры; независимый production RU/EN uplift не заявляется.

## 1. Краткий результат

Проход расширил прошлую защиту повторяющихся ID до полного defensive restore path и расширил оценку retrieval от единого агрегированного результата к диагностическим срезам по типам задач.

### Изменения в runtime

1. **Нормализация каждого восстановленного memory row.** До индексации проверяются ID, текст и допустимый тип памяти. Снимок не считается доверенным только потому, что он успешно десериализован.
2. **Типобезопасное восстановление полей.** Числовые показатели ограничиваются диапазоном, счётчики — допустимыми целыми, списки/ссылки очищаются и ограничиваются по размеру, контекст принимает только строковые значения.
3. **Content hash вычисляется заново из фактического текста.** Старый hash из snapshot не является авторитетом; это предотвращает привязку старой производной записи к изменённому содержимому.
4. **Векторы проходят finite/dimension/norm validation.** Некорректный вектор удаляется из snapshot и остаётся пустым для ленивого восстановления. Он не может попасть в derived retrieval index как корректный.
5. **Недостоверные trust-поля не повышаются до факта.** Неизвестный epistemic status, отсутствие source либо повреждённый confidence у записи со статусом fact приводят к conservative `unknown`.
6. **Повреждённое время окончания действия работает fail-closed.** Некорректный непустой `validUntilAt` становится пустым интервалом `[validFromAt, validFromAt)`, а не бессрочным фактом.
7. **Усилена проверка повторных ID.** Равноправные записи с одинаковым ID сравниваются не только по тексту и revision metadata, но и по typed context, tags, entities и связям. Конфликтующие варианты отправляются в quarantine.
8. **Memory Doctor видит потери при восстановлении.** Отброшенные некорректные строки и строки сверх лимита 1600 теперь создают ошибки аудита; разрешённые дубликаты и конфликты отдельно видны в read-only report.

### Изменения в оценке retrieval

Добавлены необязательные явные метки задач:

`single-hop`, `multi-hop`, `multi-session`, `temporal`, `knowledge-update`, `contradiction`, `preference`, `procedural`, `open-domain`, `abstention`, `other`.

Отчёт теперь рассчитывает по каждой категории отдельные:
- количество holdout вопросов, answerable и unanswerable;
- Recall@k, MRR, precision, coverage и latency;
- stale/quarantined/future/dormant/invalid result counts;
- дельты candidate vs BM25 baseline.

Срезы **диагностические**: они не меняют общий promotion gate и не могут автоматически продвигать retrieval-кандидата. Если категориями размечена только часть набора, это фиксируется как неполная разметка и блокирует promotion evidence.

## 2. Зачем были выбраны именно эти изменения

Основной риск долгосрочной памяти — не только потеря записи, но и ложная уверенность в повреждённой, устаревшей или противоречивой записи. Для NeuroCore последствия тяжелее, чем для обычного поиска: воспоминание может изменить модель пользователя, внутреннюю цель, вывод о прошлых действиях или последующий обучающий сигнал.

Поэтому порядок доверия теперь задаётся так:

`serialized bytes → validated memory row → canonical MemoryOS2 → indexed memory → eligible recall candidate → evidence-grounded result`.

На каждом переходе запрещено делать неизвестность «фактом» только из-за успешной загрузки.

## 3. Выборочная адаптация исследований и открытых проектов

### Mem0 — extraction + multi-signal retrieval + temporal reasoning

Адаптировать:
- раздельные write/extraction и read/retrieval этапы;
- entity linking как дополнительный retrieval signal;
- временную атрибуцию состояния/события/плана;
- экономию токенов и latency как обязательные метрики наряду с качеством.

Не копировать:
- Mem0 Platform как второй canonical writer;
- автоматическую запись внешних или model-generated facts без NK1 provenance/consent;
- численные benchmark claims managed Platform как ожидаемый результат NK1. Сам Mem0 отмечает, что часть результатов и оптимизаций относится к managed platform и может отсутствовать в OSS SDK.

### Letta — persistent identity and cross-session memory

Адаптировать модель долговременного состояния одной агентной идентичности, общей между диалогами. Не добавлять второй параллельный memory owner: в NK1 эту роль сохраняет `MemoryOS2`, а `MemoryFabric` отвечает за мутации и квитанции.

### Zep / Graphiti — temporal knowledge graph

Адаптировать временную модель связей: событие, сущность, период истинности, происхождение и историческая цепочка. В NK1 использовать существующие `validFromAt/validUntilAt`, revision/supersession, evidence lineage и causal/temporal links; не разворачивать второй граф-хранилище, пока не доказан конкретный пробел.

### LongMemEval / LoCoMo / BEAM — измерять способности по раздельным категориям

LongMemEval специально выделяет information extraction, multi-session reasoning, temporal reasoning, knowledge updates и abstention. LoCoMo включает single-hop, multi-hop, temporal и long-horizon dialogue задачи. BEAM добавляет large-context stress, event ordering, contradiction resolution и раздельный учёт стоимости.

Поэтому один общий Recall@k больше не должен быть единственным индикатором. Срезы по типам задач нужны, чтобы улучшение простых фактов не скрывало деградацию temporal reasoning или knowledge update.

## 4. Контракты и владение

- `MemoryOS2` — единственный canonical memory store.
- `MemoryFabric.applyLifecycleCommand(...)` — write boundary, event и replay receipt boundary.
- Embedding indexes и vectors — derived/cache data; при ошибке остаётся lexical fallback.
- Mem0 — opt-in adapter, внешний результат — unverified candidate.
- Hexis — evidence/provenance bridge; не самостоятельный владелец memory state.
- Letta/другие reference archives — архитектурные источники и governance, не автоматически подключённый runtime.
- Recall не обучает себя на собственной выдаче; reward от выдачи не равен подтверждённому исходу действия.

## 5. Проверки и как интерпретировать результат

Новый `npm run test:memory-acceptance` включает:
- defensive restore identity + malformed shape;
- lifecycle command idempotency;
- provenance lineage, revision history и compatibility migration;
- query-context stability и autobiographical recall;
- snapshot round-trip;
- vector integrity, lexical fallback и MemoryFabric retrieval;
- grounded abstention, candidate coverage, numeric terms и fuzzy recall;
- annotation-pack integrity и retrieval experiment;
- Hexis evidence bridge и Mem0 Platform/OSS wiring/safety.

Для task categories используется тот же baseline и тот же corpus snapshot, что и для основного benchmark. Категории включаются в dataset fingerprint. Частичная task annotation блокирует пригодность набора к promotion, но сами category slices не являются самостоятельной статистической promotion-границей.

Синтетические фикстуры подтверждают контракты и регрессии. Они не доказывают качество на длинной реальной истории NK1.

## 6. Состояние и дальнейшие gates

| Gate | Состояние после прохода |
|---|---|
| Defensive restore и canonical row validation | Реализовано в ветке; ждёт exact-head CI |
| Дубликаты ID / conflict quarantine | Реализовано; прежний targeted CI PASS, новая расширенная версия ждёт повторного прогона |
| Memory Doctor показывает восстановительную потерю | Реализовано; ждёт exact-head CI |
| Retrieval категории и task-slice diagnostics | Реализовано; ждёт exact-head CI |
| Lifecycle / provenance / Mem0 / Hexis регрессии | Предыдущая версия CI PASS; после последних изменений нужен новый полный прогон |
| Independent RU/EN holdout | BLOCKED: нужен неизменяемый лицензированный корпус с независимой разметкой |
| Production recall uplift / `recallDelta>0` | UNVERIFIED; не заявлять как достигнутый |
| Android/browser/real-model latency and soak | Вне scope этого прохода; не подтверждено |

### Definition of Done

Память и Recall готовы не тогда, когда все тесты на фикстурах зелёные, а когда:
1. каждый snapshot row проходит validation до индексации;
2. восстановление не превращает испорченный expiry, status, source, confidence или vector в доверенный факт;
3. история исправлений и забывания переживает реальные restart/restore без повторной мутации;
4. RU и EN holdout показывают practically meaningful uplift отдельно по языкам;
5. категории temporal, multi-hop, multi-session, knowledge-update и abstention измеряются отдельно;
6. MRR, stale/contradiction/abstention, latency, token/compute budget не деградируют недопустимо;
7. независимый review одобряет promotion; live memory никогда не меняется самим benchmark.

## 7. Файлы, изменённые в этом проходе

- `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts`
- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts`
- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalExperiment.ts`
- `runtime/neuro-kurisu/tests/memory-restore-shape-hardening.mjs`
- `runtime/neuro-kurisu/tests/memory-retrieval-experiment.mjs`
- `runtime/neuro-kurisu/package.json`

Ранее в том же PR добавлены duplicate-identity test, общий memory acceptance script, workflow и базовая документация.

## 8. Источники

- LongMemEval (ICLR 2025): https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html
- LongMemEval dataset/code: https://github.com/xiaowu0162/LongMemEval
- LoCoMo (ACL 2024): https://aclanthology.org/2024.acl-long.747/
- Mem0 evaluation methodology: https://github.com/mem0ai/mem0/blob/main/docs/core-concepts/memory-evaluation.mdx
- Mem0 paper: https://journals.sagepub.com/doi/10.3233/FAIA251160
- Letta stateful agents: https://docs.letta.com/concepts/stateful-agents
- Zep / Graphiti temporal knowledge graph paper: https://arxiv.org/abs/2501.13956

**Правило интерпретации:** scores из разных benchmark implementations нельзя сравнивать напрямую без совпадения датасета, модели, retrieval budget, token budget, judge, split и evaluation protocol.
