# Neuro-Kurisu — полный актуальный backlog до готовности (WorkPass 34)

**Основа:** WorkPass 34, 13 октября 2026 года. **Runtime:** Neuro-Kurisu 35.57.0 / schema 224. **Статус:** implementation workpass; это план завершения, а не заявление о готовности.

## Как читать список

- **P0** — блокирует безопасный/доказуемый выпуск или ключевой заявленный функционал.
- **P1** — необходимо для устойчивого полноценного продукта; выполнять до release sign-off или по утверждённому risk exception.
- **P2** — важное расширение качества после закрытия критического пути; не должно задерживать исправление P0.
- **PARTIAL** — код/стык существует, но остаётся существенный разрыв интеграции или результата. **TODO** — полноценное закрытие отсутствует. **BLOCKED** — не подтверждается в текущем окружении; нужен чистый/сетевой/браузерный target-run, но blocker остаётся настоящим.
- «Готово, когда» — критерий приёмки изменения, а не предложение заводить отдельный проход, заполненный проверками. Проверки — только приёмка реальной работы. Ориентир организации: около 90% усилий на код, интеграцию, исправления и UX; остаток — минимально достаточная приёмка.
- Статусы обновлены по коду/результатам WorkPass 23–34 и актуальным открытым gates. Там, где есть implementation, но ещё нет сквозного подтверждения, пункт помечен PARTIAL, а не DONE.

## Уже существующая база — не реализовывать заново

1. Один writable organism owner в `runtime/neuro-kurisu`; research/legacy не должны становиться вторым мозгом или памятью.
2. MotorSchema, общий ActionGateway, outcome classes и значительная часть causal/evidence plumbing уже существуют.
3. Canonical MemoryOS2, memory strategy advisory с ограниченным влиянием, bounded context budget и persistence/migration machinery уже существуют.
4. Runtime Atlas, UI API linkage, gateway, Live2D assets и настоящий sprite fallback уже существуют; полноценный браузерный UX всё ещё не доказан.
5. Research transport WorkPass 18–19 имеет HTTPS allowlist/DNS pinning/redirect limits, publisher identity, provenance, hypothesis admission и conflict quarantine; semantic claim entailment ещё отсутствует.
6. Conscio/WILL/Lumina/Hexis/Letta/NeuroCore/NOMEGA/DeepCode сохранены как source/provenance; часть идей перенесена. Их остаток нужно выбирать по пользе и canonical ownership, не копировать целыми ветками.


### WorkPass 20 implementation delta — 13.10.2026

- **DONE (WP20-03):** exact supporting/refuting quote offsets and URL/document/page-hash/publisher/fetch provenance are carried from claim assessment through ProjectResearchSession into canonical MemoryOS2 context.
- **PARTIAL (WP20-01/02):** explicit claim entry exists and yields `support/refute/mixed/unknown`, but claims are not yet extracted automatically from arbitrary multi-claim questions. Current verifier is exact-text/polarity anchor only, not an NLI model or calibrated probability.
- **PARTIAL (WP20-06):** if independent source excerpts directly support and refute the same explicit claim, prior corresponding MemoryOS2 hypotheses enter quarantine; broader conflict lineage/source syndication and surfaced evidence graph remain open.
- **DONE (WP21 implementation slice):** executor state v5 persists bounded processed-outcome receipt IDs and binds outcomes to `executionId`/`stepId`; duplicate/replayed/stale receipts cannot advance a later step using the same tool. Five replay/restart scenarios pass. Full no-double-credit across every trust/reward/temporal-credit consumer remains partial.
- **DONE (integration repair):** ActionGateway preserves external-research `independenceKey`, `sourceHost`, `fetchedAt` and explicit claim metadata.
- **DONE (WP21 lineage):** bounded cross-publisher lineage joins canonical documents, exact extracted page hashes and high-overlap 5-token shingles; short snippets are not merged based on topic alone.
- **DONE (WP21 firewall):** EvidenceFirewall counts connected publisher/story-lineage families, so syndication mirrors cannot count as independent corroboration.
- **DONE (WP21 MemoryOS2):** the canonical memory creates one hypothesis note per source lineage and stores bounded mirror URLs as provenance.
- **Still open:** semantic entailment, calibrated confidence, adversarial labelled corpus, real provider run, independent MemoryOS2 holdout, Vite build/browser E2E and release durability gates.


### WorkPass 21 implementation delta — source-lineage and canonical memory dedup

- **DONE:** normalize canonical document URLs and strip tracking-only parameters while retaining meaningful query parameters.
- **DONE:** use extracted-content identity plus bounded 5-token-shingle overlap to detect likely syndicated copies across publishers; short snippets never merge on topic similarity alone.
- **DONE:** rebuild lineage from source rows during session restore instead of trusting a persisted cluster label.
- **DONE:** EvidenceFirewall computes external source families as connected components across publisher and story-lineage nodes; copies of one story cannot satisfy corroboration by changing hostname.
- **DONE:** MemoryOS2 records one capped-confidence hypothesis per lineage and retains up to eight mirror URLs as provenance rather than duplicating long-term memories.
- **PARTIAL:** upstream wire/press-release ancestry, non-English paraphrased syndication, and false-merge/false-split rates need a labelled corpus.
- **Still open:** semantic NLI, automatic atomic-claim extraction, independent temporal MemoryOS2 holdout, real provider execution and UI/release blockers.

### WorkPass 22 implementation delta — optional local NLI and conservative claim-level gating

- **DONE (runtime integration):** opt-in HTTP NLI backend wired into existing `ProjectResearchSession`/`OrganismCore`; no parallel memory or research owner introduced.
- **DONE (service implementation):** optional local Python server using `cross-encoder/nli-deberta-v3-xsmall`; model weights are not bundled; loopback default, bounded payloads, no request-text logs, token required beyond loopback.
- **DONE (policy gate):** model-assisted support requires at least two independent model-scored lineage families; mixed/refuted/unknown claims cannot receive positive project credit.
- **PARTIAL (compound claims):** cautious atomization exists; parent compound claims stay unknown unless all relevant atoms are supported. Arbitrary language parsing remains an open issue.
- **PARTIAL (semantic verification):** mocked runtime/service contract tests pass, but no actual pretrained inference, score calibration or fixed labelled holdout was run. Raw softmax scores are not probabilities of truth.
- **Still open:** real-model/adversarial evaluation, calibration and language-specific thresholds, full source genealogy, independent temporal memory holdout, live provider run, app build/browser E2E, clean-room rollback, soak and release sign-off.


### WorkPass 31 implementation delta — canonical mutation lifecycle and durable idempotency

- **DONE (G81):** added `MemoryFabric.applyLifecycleCommand` as the application-level write boundary for canonical encode, epistemic status revision, content revision, signal updates, context patches and forgetting; `MemoryOS2` remains the only writable owner.
- **DONE (persistence seam):** a bounded 512-entry receipt journal fingerprints command payloads, suppresses duplicate mutation/events after exact replay, and fails closed when the same `commandId` is reused for different payload.
- **DONE (integration):** production compatibility restore/ingest, Hexis review writes and external research ingestion route through the gateway. Deterministic compatibility command IDs protect restore/retry from replay duplication.
- **DONE (migration):** `StateMigrations` now sanitizes and carries valid mutation receipts into the next persisted state instead of dropping the extension field; the focused regression exercises the normal migration function as well as direct snapshot restore.
- **Still open:** old direct-write methods remain only as legacy compatibility adapters for historical callers; their remaining consumer contracts should be retired in a separate migration. Independent temporal retrieval holdout, real NLI inference, production browser/Live2D E2E, clean-room recovery/rollback, soak and release sign-off remain open.

## Общий порядок

Первый обязательный путь: **семантические evidence verdicts → полный agency/outcome loop → качественная память и независимый holdout → build/UI E2E → clean-room recovery/rollback → RC sign-off**. Архитектурную декомпозицию выполнять небольшими срезами между изменениями поведения, не замораживать разработку ради тотального переписывания.

## Проход 20 — Семантическая доказательность research (WorkPass 20: частично реализован, semantic NLI ещё открыт)

*Цель: перестать путать тематическое совпадение и разнообразие источников с доказательством утверждения. До завершения этого прохода внешние находки остаются гипотезами.*

- [P0][PARTIAL] **WP20-01 Выделить из исследовательского вопроса атомарные проверяемые claims.** Готово, когда: У каждого ответа есть список отдельных проверяемых утверждений с устойчивыми ID; не использовать один общий claim на целую страницу.
- [P0][PARTIAL] **WP20-02 Добавить claim-specific verdict: support / refute / mixed / unknown.** Готово, когда: Каждый фрагмент получает один из исходов и объяснение; лексическое совпадение не может дать support.
- [P0][DONE] **WP20-03 Связывать verdict с точными цитируемыми фрагментами.** Готово, когда: Для каждого вывода хранить URL, document key, заголовок, диапазон/фрагмент, время извлечения и хеш.
- [P0][TODO] **WP20-04 Разделить факты источника, выводы агента и неизвестное.** Готово, когда: UI, память и генератор ответа получают отдельные поля; неизвестное не превращать в уверенный ответ.
- [P0][TODO] **WP20-05 Ввести явную обработку частичной поддержки.** Готово, когда: Источник, подтверждающий только часть утверждения, не повышает уверенность всего составного claim.
- [P0][PARTIAL] **WP20-06 Добавить обработку опровержения и смешанных свидетельств.** Готово, когда: Противоречащий источник снижает статус/уверенность и оставляет видимой цепочку аргументов, а не перезаписывает факт молча.
- [P0][TODO] **WP20-07 Сделать claim-level confidence калибруемой, не ручной константой.** Готово, когда: Уверенность рассчитывается по качеству/типу свидетельства и проходит калибровку на размеченном наборе; числовая метка не выдаётся за вероятность без калибровки.
- [P0][TODO] **WP20-08 Создать adversarial corpus против keyword stuffing.** Готово, когда: Набор включает страницы с теми же ключевыми словами, но без поддержки, с отрицанием, цитатой чужого мнения и устаревшими данными; ложное подтверждение должно блокироваться.
- [P0][PARTIAL] **WP20-09 Учитывать независимость первоисточников, а не только hostname.** Готово, когда: Точные и высоко похожие перепечатки склеиваются по ограниченному lexical lineage; обнаружение первоисточника пресс-релиза и полного графа цитирования ещё требуется.
- [P1][PARTIAL] **WP20-10 Разделять факт, мнение, прогноз, рекламу и пересказ.** Готово, когда: Тип источника/утверждения влияет на допустимый вес и отображается оператору.
- [P1][TODO] **WP20-11 Учитывать дату факта отдельно от даты получения страницы.** Готово, когда: У временных claims есть effective date/valid interval, а устаревший материал не побеждает только за счёт свежего fetch.
- [P1][TODO] **WP20-12 Добавить обязательную неопределённость при недостатке доказательств.** Готово, когда: Если источники нерелевантны, конфликтуют или не покрывают утверждение, агент сообщает unknown/insufficient evidence и не повышает память до факта.

## WorkPass 21 additions — source lineage and memory deduplication

- [P0][DONE] **WP21-L01 Canonicalize research document identity and identify likely syndicated copies.** Готово, когда: tracking URL variants resolve to one document; long near-duplicate excerpts can join one lineage; short topical overlaps remain distinct.
- [P0][DONE] **WP21-L02 Make EvidenceFirewall count source-lineage families, not raw publisher labels alone.** Готово, когда: two publisher domains copying one story cannot satisfy corroboration, but unrelated publishers/lineages remain independently admissible; restored sessions recompute lineage.
- [P0][DONE] **WP21-L03 Deduplicate syndicated excerpts in canonical MemoryOS2 without losing provenance.** Готово, когда: one hypothesis note is stored per story lineage and bounded alternate URLs remain queryable as mirrors.

## Проход 21 — Замыкание цикла агентности и последствий действий

*Цель: один реальный цикл от наблюдения до проверенного внешнего результата, устойчивого сохранения и обновления поведения; не имитировать успех по ответу инструмента.*

- [P0][PARTIAL] **WP21-01 Замкнуть AffordanceField → ActionCompetition → arbiter → ActionGateway.** Готово, когда: Решение выбирается из фактически доступных действий и проходит один canonical policy-owner; исследовательские кандидаты не исполняются напрямую.
- [P0][PARTIAL] **WP21-02 Зафиксировать preconditions и postconditions у каждого action contract.** Готово, когда: MotorSchema/skill описывает входы, побочные эффекты, ожидаемое состояние и допустимый способ проверки результата.
- [P0][PARTIAL] **WP21-03 Требовать независимое внешнее подтверждение для внешних действий.** Готово, когда: HTTP 200 или текст tool ответа недостаточен; сохраняется receipt/наблюдение, полученное независимо от самоотчёта инструмента.
- [P0][PARTIAL] **WP21-04 Убрать двойное начисление одного успеха.** Готово, когда: Одинаковое событие/outcome не должно дважды увеличивать reward, competence, trust, strategy memory или causal credit даже при replay/retry.
- [P0][PARTIAL] **WP21-05 Довести idempotency от локального вызова до внешнего провайдера.** Готово, когда: Ключи идемпотентности, remote receipt и состояние неопределённого завершения переживают timeout/reconnect; не заявлять exactly-once там, где провайдер его не гарантирует.
- [P0][PARTIAL] **WP21-06 Согласовать outcome class во всех ветках исполнения.** Готово, когда: policy-refused, unavailable, competence-insufficient, timeout, execution-failed и verified/unverified сохраняются одинаково в прямом, compound и project-tool пути.
- [P0][PARTIAL] **WP21-07 Связать verified outcome → reafference → temporal credit.** Готово, когда: Результат сравнивается с предсказанным состоянием; ошибку предсказания привязать к исходному action/event и цели.
- [P1][PARTIAL] **WP21-08 Сохранить полный lineage observation → plan → action → receipt → outcome → update.** Готово, когда: Каждое звено имеет correlation/parent ID; трассу можно восстановить после перезапуска без эвристического сопоставления по времени.
- [P1][TODO] **WP21-09 Добавить компенсацию/безопасный abort для частично выполненных compound actions.** Готово, когда: При сбое шага система знает, какие эффекты выполнены, что можно отменить и что требует ручного подтверждения.
- [P1][PARTIAL] **WP21-10 Распространять cancellation и deadlines по всем шагам.** Готово, когда: Отмена пользователя прекращает ожидание, retries и дальнейшие шаги; просроченный результат не начисляется как свежий успех.
- [P1][PARTIAL] **WP21-11 Завершить circuit breaker, backpressure и restartability для event flow.** Готово, когда: Перегрузка не раздувает очередь и не порождает повторную обработку; деградировавший модуль можно безопасно восстановить.
- [P1][TODO] **WP21-12 Проверять причинность до обновления политики.** Готово, когда: Корреляция между действием и успехом не считается причинным эффектом без контроля базового уровня/альтернатив.
- [P1][TODO] **WP21-13 Разделить исполнение в shadow mode и действия с реальными побочными эффектами.** Готово, когда: Новые стратегии сначала прогнозируют/оценивают, но не выполняются снаружи без явной promotion policy.
- [P1][PARTIAL] **WP21-14 Сделать capability evidence graph для главных сценариев.** Готово, когда: Для чата, памяти, поиска и внешнего действия путь заканчивается подтверждённым результатом, сохранением, отображением UI и восстановлением после restart.

## WorkPass26 — закрытая часть temporal MemoryOS2 inspector

- [x] Исправить архивный retrieval и default point-in-time semantics; изолировать read-only preview на MemoryOS2/MemoryFabric/Core.
- [x] Подключить temporal controls к Runtime Atlas и API client; regression покрывает current, historical, all revisions и отсутствие side effects.
- [x] Исправить route-dispatch: memory inspector и два соседних diagnostic routes более не прячутся под early-return handler; реальный server smoke закрывает default `asOfAt`/explicit zero/limit regression.
- [ ] Не считать memory quality promoted: независимый holdout, BM25 baseline и frontend/browser E2E остаются открытыми.

## Проход 22 — MemoryOS2 / Memory 2.0: качество, а не объём памяти

*Цель: улучшить полезное извлечение, temporal tracking и коррекцию знаний, не создавать второй memory owner и не усиливать стратегию без измеримого выигрыша.*

- [P0][PARTIAL] **WP22-01 Создать отдельный project holdout из независимых длинных сессий.** Готово, когда: Данные для финальной оценки не используются для выбора параметров; вопросы покрывают факт, время, конфликт, коррекцию и «не знаю».
- [P0][PARTIAL] **WP22-02 Сравнить canonical MemoryOS2 с простым BM25 baseline.** WorkPass27 добавил воспроизводимый corpus-scoped Okapi BM25 (k1=1.2, b=0.75), latency/result-integrity метрики и fingerprint конфигурации. Готово полностью, когда: есть независимый temporal holdout и повторяемое сравнение на нём; текущий синтетический fixture показывает candidate Recall@5 delta -0.25 и не разрешает promotion.
- [P0][PARTIAL] **WP22-03 Сопоставить hybrid FTS/BM25 + trigram + RRF с более простыми вариантами.** Готово, когда: Оставить комбинацию только если она выигрывает на holdout, а не только в synthetic fixtures.
- [P0][TODO] **WP22-04 Запустить релевантный набор LongMemEval-V2 по memory abilities.** Готово, когда: Использовать официальный harness и доступный бюджет; отдельно учитывать answer accuracy и retrieval/query latency, не приписывать бенчмарку доказательство общей интеллектуальности.
- [P0][DONE] **WP22-05 Проверить temporal state tracking и superseded memories.** WorkPass26: тест подтверждает, что новое значение активно в `current`, старое извлекается в `at` до границы валидности, обе ревизии сохраняются в `all`, а inspector preview не меняет live state, retrieval accounting или adaptive policy. Доказательство — `runtime/neuro-kurisu/tests/memory-temporal-inspector-closure.mjs`. Независимый labelled holdout (WP22-01) остаётся открытым; WorkPass27 добавил BM25 comparator, но его внешний holdout ещё не запускался.
- [P0][PARTIAL] **WP22-06 Довести conflict resolution от detection до correction workflow.** Готово, когда: При конфликте старое знание получает status/expiry/review link; оно не продолжает попадать в обычный recall без оговорки.
- [P1][PARTIAL] **WP22-07 Согласовать duplicate consolidation и provenance.** Готово, когда: Дубликаты объединяются без потери происхождения, уверенности, временных границ и разных контекстов употребления.
- [P1][PARTIAL] **WP22-08 Реализовать управляемое забывание и retention tiers.** Готово, когда: Приоритетные, временные, личные и недостоверные записи имеют разные сроки/политику; удаление учитывает все проекции и индексы.
- [P1][PARTIAL] **WP22-09 Проверить source reliability и confidence decay на реальных траекториях.** Готово, когда: Вес источника меняется по реальным проверенным исходам, не самообучается из собственных сгенерированных ответов.
- [P1][PARTIAL] **WP22-10 Сделать promotion research notes обратимым.** Готово, когда: Hypothesis → accepted/rejected/contested хранит причину и историю; conflict возвращает заметку в quarantine и исключает её из нормального recall.
- [P1][PARTIAL] **WP22-11 Увязать causal/self/episodic/semantic память без дублей владельцев.** Готово, когда: Проекции используют canonical IDs и ссылочную связь, а не независимые копии одного writable состояния.
- [P1][PARTIAL] **WP22-12 Измерить latency, cost и рост памяти на длинной истории.** Готово, когда: Установить бюджеты и graceful degradation; при достижении лимита нет неограниченного замедления или потери критических записей.
- [P1][TODO] **WP22-13 Проверить стратегическую память на абляциях.** Готово, когда: Сравнить выключенную стратегию, текущий ограниченный advisory и вариант-кандидат; влияние на действие расширять только при устойчивом uplift.
- [P2][TODO] **WP22-14 Добавить пользовательскую проверку/исправление запомненных сведений.** Готово, когда: Исправление имеет аудитный след и меняет canonical memory; UI не создаёт собственную отдельную память.

## Проход 23 — Надёжное внешнее исследование и транспорт

*Цель: доказать работу на реальных разрешённых HTTPS-источниках и безопасно встроить найденное содержимое.*

- [P0][BLOCKED] **WP23-01 Провести live research на двух разрешённых внешних HTTPS-хостах.** Готово, когда: В целевой сети получены реальные разные страницы; DNS/TLS/redirect/fetch provenance и session state сохранены. Текущий sandbox не доказал live-provider путь.
- [P0][PARTIAL] **WP23-02 Заменить ручную таблицу доменных суффиксов на корректную PSL-логику.** Готово, когда: Publisher-family parsing использует поддерживаемый Public Suffix List или консервативный отказ; custom-table не выдаётся за полное решение.
- [P0][PARTIAL] **WP23-03 Довести SSRF boundary по OWASP-подходу.** Готово, когда: Проверяются все A/AAAA ответы, IPv4/IPv6 private/link-local/loopback/reserved адреса, redirect hop, DNS rebinding и нестандартные URL формы.
- [P1][TODO] **WP23-04 Санитизировать/нормализовать HTML и извлечение основного текста.** Готово, когда: Скрипты, навигация, скрытые вставки и управляющие символы не влияют на evidence; исходный фрагмент и normalized text различимы.
- [P1][TODO] **WP23-05 Отделить содержимое страницы от инструкций агенту.** Готово, когда: Веб-страница/документ считается недоверенными данными; prompt injection из результатов не может менять system policy, инструменты или allowlist.
- [P1][PARTIAL] **WP23-06 Добавить лимиты на concurrency, rate, cache и бюджет домена.** Готово, когда: Параллельные запросы ограничены; кэш имеет TTL и query identity; отмена/таймаут освобождает ресурсы.
- [P1][TODO] **WP23-07 Покрыть content encodings, charset, malformed responses и MIME edge cases.** Готово, когда: Поддерживаемые типы декодируются ограниченно, неизвестные форматы отказываются; decompression bombs и некорректные кодировки не истощают память.
- [P1][PARTIAL] **WP23-08 Сохранять end-to-end research receipt.** Готово, когда: Запрос, выбранные источники, редиректы, время, извлечённые фрагменты, verifier verdict и memory promotion связываются единым run ID.
- [P1][TODO] **WP23-09 Добавить адаптеры реальных search/API провайдеров с ясными контрактами.** Готово, когда: Провайдеры включаются конфигурацией и capability policy; отсутствие ключа/сети явно показывается как unavailable, а не замещается фальшивым ответом.
- [P1][TODO] **WP23-10 Ввести refresh/expiry и повторную перепроверку изменяемых фактов.** Готово, когда: Для изменяемых фактов хранится expiry; обновление того же document key проходит через тот же конфликтный workflow.
- [P2][TODO] **WP23-11 Поддержать понятное пользователю раскрытие источников и ограничений.** Готово, когда: Ответ показывает цитаты и причины support/refute/unknown; пользователь может открыть первоисточник и оспорить ошибку.
- [P2][TODO] **WP23-12 Сделать offline research replay из сохранённых receipt-ов.** Готово, когда: Повторный разбор сохранённого материала не требует сетевого доступа и не подменяет live-fetch claims.

## Проход 24 — Извлечение полезного из исходных веток и исследовательских проектов

*Цель: интегрировать все действительно полезные идеи из WILL, Lumina, Hexis, Letta, Conscio, NeuroCore, NOMEGA и DeepCode без bulk-copy, дублей и вторых владельцев состояния.*

- [P1][PARTIAL] **WP24-01 Закрыть source-candidate registry для всех сохранившихся веток.** Готово, когда: Каждый значимый модуль получает owner, capability, expected benefit, failure modes, tests, licence/provenance и решение promote/adapt/archive/reject.
- [P1][PARTIAL] **WP24-02 Разобрать NOMEGA consolidation queue по одному кандидату за раз.** Готово, когда: 119 кандидатных записей классифицированы по измеримой пользе и зависимостям; неподтверждённые идеи не сливаются массово в runtime.
- [P1][PARTIAL] **WP24-03 Проверить Conscio hybrid retrieval integration end-to-end.** Готово, когда: FTS/BM25/trigram/RRF подключены к canonical MemoryOS2 projection и не содержат отдельного writable memory owner.
- [P1][PARTIAL] **WP24-04 Довести skill federation quarantine → trial → promotion.** Готово, когда: Skill не становится активным только из-за регистрации; требуется ограниченный trial, external outcome receipts и обратимая promotion.
- [P1][PARTIAL] **WP24-05 Закрыть remote ACK/replay/idempotency seam из WILL/Conscio.** Готово, когда: Очередь переживает reconnect/retry, получает remote receipt и различает delivered/accepted/processed/failed.
- [P1][PARTIAL] **WP24-06 Довести Hexis Control Console только через существующие реальные endpoints.** Готово, когда: Каждая write-команда имеет авторизацию, schema, audit trail и подтверждение; отсутствующие endpoints показываются как unavailable, не как работающие переключатели.
- [P1][PARTIAL] **WP24-07 Сверить Lumina browser/tool sandbox patterns с ActionGateway.** Готово, когда: Политики browser/navigation/download/file access не дублируют runtime policy и не обходят общий gateway.
- [P1][PARTIAL] **WP24-08 Перенести полезные Letta provenance/artifact-review semantics.** Готово, когда: Источники и сгенерированные артефакты имеют lineage, reviewer state и историю изменений в canonical structures.
- [P1][PARTIAL] **WP24-09 Продолжить NeuroCore V143 evaluation на переносимых путях.** Готово, когда: Все launchers используют project-local output/CLI override; multi-seed и baseline результаты приложены к candidate manifest.
- [P1][PARTIAL] **WP24-10 Закрыть DeepCode rssm_prior audit.** Готово, когда: Проверить обучаемость, градиенты, shape contracts, posterior/prior collapse и фактическое использование в активной траектории.
- [P1][PARTIAL] **WP24-11 Закрыть DeepCode EB query gradient audit.** Готово, когда: Подтвердить, что query влияет на градиент/выбор и улучшает метрики; иначе удалить/архивировать неработающий путь.
- [P1][PARTIAL] **WP24-12 Закрыть DeepCode discrete option selection audit.** Готово, когда: Опции реально выбираются/исполняются и отражаются в outcome; недостижимая ветка не остаётся декоративной.
- [P1][TODO] **WP24-13 Классифицировать исследовательские placeholder/stub-кодовые пути.** Готово, когда: Каждый placeholder в активной исследовательской ветке заменён алгоритмом либо изолирован как тестовый fixture; названия методов не считаются функциональностью.
- [P1][TODO] **WP24-14 Не допускать import из legacy/input-archives в production runtime.** Готово, когда: Активные импорты исходников идут через адаптированные модули с ownership contract, лицензией и зависимостями.
- [P2][TODO] **WP24-15 Обновить branch coverage по реальному коду после каждого promotion.** Готово, когда: Матрица показывает конкретные source file → canonical file → адаптация → результат, а не только название проекта.

## Проход 25 — Обучение и отбор улучшений

*Цель: проверять, что обучение действительно улучшает поведение; не продвигать красивые нейроподобные конструкции без выигрыша относительно простого baseline.*

- [P0][PARTIAL] **WP25-01 Зафиксировать базовые модели, datasets, seeds и версии зависимостей.** Готово, когда: Любой benchmark можно повторить по manifest, включая dataset hash, model commit/checkpoint и параметры.
- [P0][TODO] **WP25-02 Сделать multi-seed сравнение главных когнитивных кандидатов.** Готово, когда: Результаты показывают разброс/доверительные интервалы; выбор кандидата не опирается на один удачный seed.
- [P1][TODO] **WP25-03 Сделать controlled ablation для памяти, planning, reafference и reward.** Готово, когда: Каждый вклад измерен отдельно; неудачные/нейтральные компоненты не остаются обязательными по инерции.
- [P1][TODO] **WP25-04 Добавить long-horizon trajectory benchmark.** Готово, когда: Сценарии включают цепочки действий, задержанные последствия, исправление ошибок и восстановление после сбоя.
- [P1][TODO] **WP25-05 Добавить continual-learning benchmark с последующими изменениями.** Готово, когда: Измерять обучение новым данным, сохранение старых способностей и конфликт между старой/новой информацией.
- [P1][PARTIAL] **WP25-06 Довести experiment registry до хранения артефактов и причин решения.** Готово, когда: Для каждого эксперимента есть конфигурация, stdout/stderr, метрики, failure reason и promote/reject rationale.
- [P1][PARTIAL] **WP25-07 Усилить anti-collapse/catastrophic-forgetting gates.** Готово, когда: После каждого обучения оцениваются удержание старого, разнообразие поведения и деградация baseline задач.
- [P1][PARTIAL] **WP25-08 Зафиксировать единый optimizer/gradient/update budget policy.** Готово, когда: Все обучаемые подсистемы соблюдают ресурсные лимиты и не изменяют поведение во время критичного пользовательского действия.
- [P1][PARTIAL] **WP25-09 Сделать promotion откатываемым и версионированным.** Готово, когда: Новая политика/модель запускается shadow/canary, имеет контрольный checkpoint и автоматический rollback по regression threshold.
- [P1][TODO] **WP25-10 Калибровать confidence через Brier/ECE и reliability curves.** Готово, когда: Уверенность сопоставляется с наблюдаемой точностью на holdout; некалиброванные числа не используются как вероятности.
- [P2][TODO] **WP25-11 Сравнить spiking/plasticity substrate с простым аналогом.** Готово, когда: Продвигать биологически вдохновлённый модуль только если он показывает измеримое преимущество по конкретной задаче и стоимости.
- [P2][TODO] **WP25-12 Ограничить автономное онлайн-обучение безопасными режимами.** Готово, когда: Изменения модели/политики сначала проходят shadow evaluation, имеют журнал причин и reversible snapshot.

## Проход 26 — LLM, prompt pipeline и выбор провайдера

*Цель: повысить надёжность ответов и поведения при отказе моделей, сохранив реальную стоимость и управляемые границы.*

- [P0][PARTIAL] **WP26-01 Уточнить prompt contract для normal/proposal/tool-call путей.** Готово, когда: Все генераторы используют единые обязательные поля контекста и помечают недоверенные цитаты как данные.
- [P0][PARTIAL] **WP26-02 Ввести post-generation semantic/shape validation.** Готово, когда: Проверяется schema, ссылки на tool outputs, соответствие вопросу и незаявленные факты; дефектный structured output не исполняется.
- [P1][PARTIAL] **WP26-03 Согласовать structured-answer, free-form и offline режимы.** Готово, когда: Режим выбирается по задаче, provider capability и наличию сети; UI честно сообщает о degraded/offline состоянии.
- [P1][PARTIAL] **WP26-04 Довести hallucination/uncertainty labels до фактической цепочки доказательств.** Готово, когда: Метка uncertainty берётся из claim/evidence state, а не добавляется генератором произвольно.
- [P1][PARTIAL] **WP26-05 Уточнить task-based provider selection.** Готово, когда: Выбор учитывает задачи, latency, качество, privacy, доступность инструмента и budget, с безопасным fallback.
- [P1][PARTIAL] **WP26-06 Сделать token/context budget единым для всех builder-ов.** Готово, когда: Normal, proposal, retry и tool prompts соблюдают общий лимит и возвращают omission ledger.
- [P1][PARTIAL] **WP26-07 Защитить tool arguments от malformed/overbroad model output.** Готово, когда: Вызов проходит schema + policy validation; модель не может добавить неразрешённые параметры или расширить полномочия.
- [P1][PARTIAL] **WP26-08 Согласовать retries, timeout, cancellation и circuit breakers провайдеров.** Готово, когда: Нет скрытого бесконечного ожидания/повторного платного действия; каждый retry имеет бюджет и trace.
- [P2][TODO] **WP26-09 Измерять provider quality by task, а не только health/latency.** Готово, когда: Хранить отдельные accuracy/format/error/price metrics с privacy-respecting data minimization.
- [P2][TODO] **WP26-10 Добавить user-level настройки приватности и внешних provider opt-out.** Готово, когда: Режим локальный/удалённый объясним пользователю и реально применяется к маршрутизации.

## Проход 27 — Архитектура и интеграционная структура

*Цель: уменьшить риск изменений и внутренние дубли без переписывания проекта ради красоты.*

- [P1][PARTIAL] **WP27-01 Разделить OrganismCore.ts (11 442 строки) по существующим доменам.** Готово, когда: Выделить сервисы по ownership-boundary, начиная с research/persistence/policy/context; каждый новый модуль имеет один owner, а Core остаётся фасадом/orchestrator.
- [P1][PARTIAL] **WP27-02 Разделить server.mjs (1 866 строк) по маршрутам/контроллерам.** Готово, когда: Отдельные route handlers используют один общий middleware/auth/error contract; не плодить конкурирующие серверы.
- [P1][PARTIAL] **WP27-03 Снизить размер и связанность StateMigrations.ts (1 366 строк).** Готово, когда: Миграции имеют последовательные версии, отдельные функции и deterministic fixtures; старые версии остаются читаемыми.
- [P1][PARTIAL] **WP27-04 Довести event bus до единого canonical envelope и causal IDs.** Готово, когда: Correlation/source/parent/cause поля обязательны на boundary; порядок/повторы определены контрактом.
- [P1][PARTIAL] **WP27-05 Устранить дублирующие retrieval/action/policy implementations.** Готово, когда: Для каждой capability объявлен canonical owner; исследовательские варианты — адаптеры/shadow, не параллельные writable пути.
- [P1][PARTIAL] **WP27-06 Сократить deep-relative imports и закрепить публичные module contracts.** Готово, когда: Крупные домены импортируются через устойчивые интерфейсы; циклические зависимости отсутствуют.
- [P1][TODO] **WP27-07 Провести реальную dead-code/unused-export консолидацию с удалением.** Готово, когда: Удалять только после reference graph и активного route check; исторические файлы сохранять только в provenance layer.
- [P1][PARTIAL] **WP27-08 Синхронизировать docs/ARCHITECTURE.md и contracts/OWNERSHIP.md с 35.41.0.** Готово, когда: Убрать устаревшие указания 35.40 там, где они описывают текущего владельца; исторические версии пометить как исторические.
- [P1][PARTIAL] **WP27-09 Свести список дел к одному canonical backlog.** Готово, когда: Старые счётчики 350 задач и статусы 2026-10-06 не суммируются с WorkPass 19; текущий статус генерируется из единого реестра.
- [P1][TODO] **WP27-10 Сократить исторические release scripts до поддерживаемого набора.** Готово, когда: Сохранить тестируемые suites, но обозначить canonical gates; удалить сломанные/дублирующие команды после проверки потребителей.
- [P2][TODO] **WP27-11 Автоматизировать ownership/dependency graph из кода.** Готово, когда: Граф показывает source → adapter → canonical owner → API/UI; изменения генерируют читаемый diff.
- [P2][TODO] **WP27-12 Установить правила naming/export/error contracts для новых модулей.** Готово, когда: Новые модули используют uniform cancellation, error codes, provenance и resource budgets.

## Проход 28 — Безопасность, права и приватность

*Цель: закрыть реальные угрозы эксплуатации приложения, внешних инструментов и долгосрочной личной памяти; применять stable OWASP ASVS 5.0 как контрольный каталог, а не как формальную бумагу.*

- [P0][PARTIAL] **WP28-01 Закрыть authentication/authorization для всех writable runtime endpoints.** Готово, когда: Каждый endpoint имеет явный access policy; диагностика/read-only не должна предоставлять обход write-политики.
- [P0][PARTIAL] **WP28-02 Устранить path traversal и неограниченные filesystem writes.** Готово, когда: Все пути разрешаются относительно утверждённых roots, symlink/encoded traversal cases безопасно обрабатываются.
- [P0][PARTIAL] **WP28-03 Закрыть secrets lifecycle для env, logs, errors и client bundle.** Готово, когда: Ключи не попадают в архив, telemetry, error body, browser bundle или debug endpoint; redaction применяется до записи.
- [P0][PARTIAL] **WP28-04 Добавить schema/size/rate limits на все input/API boundaries.** Готово, когда: JSON глубина, строки, arrays, attachments, concurrency и payload bytes ограничены единым policy.
- [P0][PARTIAL] **WP28-05 Пройти SSRF/redirect/DNS pinning edge cases.** Готово, когда: Реальные URL parsing cases, IPv6, rebinding, multi-answer DNS, redirects и parser differential не дают обхода allowlist.
- [P1][PARTIAL] **WP28-06 Определить CORS, CSRF, cookie/token и session policy.** Готово, когда: Local dev и production profiles разделены; write-запросы защищены согласно типу auth и threat model.
- [P1][PARTIAL] **WP28-07 Ограничить subprocess/tool execution capability.** Готово, когда: Каждый executor имеет allowlist программ/аргументов, timeout, cwd, env allowlist, output cap и запрет случайного shell interpolation.
- [P1][TODO] **WP28-08 Добавить prompt-injection boundary для web/docs/tool output.** Готово, когда: Внешние тексты не могут изменять system instructions, разрешённые домены, secrets access или подтверждение побочных эффектов.
- [P1][PARTIAL] **WP28-09 Установить retention/export/delete policy для пользовательской памяти.** Готово, когда: Пользователь может просмотреть/исправить/удалить данные в пределах заявленной политики; удаляются связанные индексы/проекции.
- [P1][TODO] **WP28-10 Решить encryption-at-rest и защиту резервных копий по threat model.** Готово, когда: Секреты и личные данные имеют документированный способ защиты; если шифрование не применяется, ограничение объявлено и путь/права каталогов проверены.
- [P1][PARTIAL] **WP28-11 Добавить security audit trail для опасных операций.** Готово, когда: Кто/когда/какую операцию подтвердил и итог записывается без секретов; журнал устойчив к обычным runtime сбоям.
- [P1][PARTIAL] **WP28-12 Установить per-tool permission scopes и подтверждение опасных действий.** Готово, когда: Нельзя повысить capability через prompt, research candidate, UI-only state или повторно переданное событие.
- [P1][TODO] **WP28-13 Пройти stable OWASP ASVS 5.0 список применимых требований.** Готово, когда: На каждое применимое требование есть кодовое основание или явный accepted risk; не заявлять formal certification без независимого assessment.
- [P2][TODO] **WP28-14 Провести dependency vulnerability и license policy для runtime/app/research.** Готово, когда: Неиспользуемые и рискованные зависимости удаляются/обновляются по совместимости; лицензии source branches учитываются.

## Проход 29 — Persistence, migration и восстановление

*Цель: состояние организма должно обновляться атомарно, переживать миграции/сбои и восстанавливаться без потери provenance и двойного исполнения.*

- [P0][PARTIAL] **WP29-01 Сделать schema migration chain обязательной частью upgrade.** Готово, когда: Каждая версия имеет from/to, preconditions, idempotency и понятное сообщение при неподдерживаемом downgrade.
- [P0][PARTIAL] **WP29-02 Провести clean-room backup → restore → restart с реальным state.** Готово, когда: Восстановлены memory, event lineage, research firewall, active goals и migrations; после restart данные читаются тем же canonical owner.
- [P0][TODO] **WP29-03 Провести upgrade from WorkPass19 и rollback к предыдущему архиву.** Готово, когда: Откат приложения и состояния определён и практически проверен; несовместимые обратные миграции не маскируются.
- [P1][PARTIAL] **WP29-04 Сделать snapshot/restore атомарным при сбое посередине.** Готово, когда: Staging/rename/fsync или эквивалентный протокол гарантирует старое либо новое целое состояние, не частичный файл.
- [P1][PARTIAL] **WP29-05 Завершить corruption recovery для memory, manifests и journals.** Готово, когда: Повреждённый фрагмент изолируется, backup предлагается безопасно, неизвестное состояние не объявляется healthy.
- [P1][PARTIAL] **WP29-06 Проверять lock ownership, stale lock и concurrent restore.** Готово, когда: Нельзя восстановить state поверх живого runtime; устаревший lock идентифицируется и освобождается явно, без эвристического удаления чужого lock.
- [P1][PARTIAL] **WP29-07 Сохранять provenance/status через все schema migrations.** Готово, когда: URL, document key, evidence state, action receipts, strategy provenance и claim lineage не исчезают после миграции.
- [P1][TODO] **WP29-08 Добавить retention/rotation для журналов и checkpoints.** Готово, когда: Лимиты не удаляют последний пригодный backup или сведения, необходимые для аудита инцидента.
- [P1][PARTIAL] **WP29-09 Привести path handling к поддерживаемым OS профилям.** Готово, когда: Пути с пробелами/non-ASCII, Windows separators, symlink и каталоги вне cwd обрабатываются явно.
- [P2][TODO] **WP29-10 Добавить export/import пользовательского состояния с версиями.** Готово, когда: Экспорт переносим, проверяем checksum, имеет схему и понятный отчёт о пропуске несовместимых элементов.

## Проход 30 — UI, desktop/mobile и Live2D как реальный продукт

*Цель: сделать приложение доступным для использования в браузере, а не только доказать HTTP/API связь или отрисовать оболочку.*

- [P0][BLOCKED] **WP30-01 Восстановить все app dependencies через clean npm install/ci.** Готово, когда: Lockfile устанавливается на чистом окружении; vite, vite/client, @types/node и прочие определения разрешаются без ручных локальных исправлений.
- [P0][BLOCKED] **WP30-02 Довести полноценные app typecheck и production Vite build.** Готово, когда: Root typecheck и production bundle проходят в чистой среде; сборка не зависит от глобальных пакетов.
- [P0][TODO] **WP30-03 Добавить настоящие браузерные E2E через Playwright.** Готово, когда: Запуск приложения, login/auth, chat, видимый результат, ошибки сети и console/network failures проверяются в реальном browser runtime.
- [P0][TODO] **WP30-04 Закрыть E2E чата: submit → runtime → response → conversation history.** Готово, когда: Пустой, длинный, Unicode, cancel, timeout и provider unavailable сценарии не теряют историю и показывают корректный статус.
- [P0][TODO] **WP30-05 Закрыть E2E research → hypothesis → conflict → quarantine → UI.** Готово, когда: Источник виден, гипотеза не отображается как факт, конфликт возвращает запись из обычного recall, статус переживает restart.
- [P1][TODO] **WP30-06 Закрыть continuity E2E через reload/restart новой сессии.** Готово, когда: История/память восстанавливается с корректной принадлежностью и не смешивает пользователя/сессию.
- [P1][TODO] **WP30-07 Проверить действующие Hexis/Conscio/Letta control surfaces.** Готово, когда: Write controls включены только при работающем защищённом handler; иначе UI показывает read-only/unavailable без фиктивного успеха.
- [P1][TODO] **WP30-08 Провести Live2D browser E2E на настоящих поставленных assets.** Готово, когда: Модель и motion graph загружаются, интеракции работают, ошибки ресурсов отображаются, fallback не маскируется за успешную Live2D-сессию.
- [P1][PARTIAL] **WP30-09 Синхронизировать губы с аудио или честно оставить speaking animation.** Готово, когда: Если требуется lip-sync, использовать реальный audio envelope/visemes; иначе маркировать как простую speaking animation, без претензии на синхронизацию фонем.
- [P1][TODO] **WP30-10 Проверить legacy sprite fallback на отказе Live2D.** Готово, когда: Все sprite ID существуют, переход не зависает и недоступность текущего renderer видна пользователю.
- [P1][TODO] **WP30-11 Довести mobile viewport и touch UX.** Готово, когда: Чат, research dock, runtime atlas, consoles и настройки работают на узком экране/клавиатуре устройства без недоступных кнопок.
- [P1][TODO] **WP30-12 Довести desktop responsive layouts.** Готово, когда: Панели не перекрывают основной чат, длинные трассы/сообщения остаются читаемыми и прокручиваемыми.
- [P1][PARTIAL] **WP30-13 Закрыть keyboard navigation, focus order и screen-reader semantics.** Готово, когда: Все действия доступны без мыши; labels/status/errors объявляются ассистивным технологиям.
- [P1][TODO] **WP30-14 Проверить offline/degraded/error UI по реальному состоянию сервисов.** Готово, когда: UI никогда не показывает ready/connected/success по локальным флагам, если backend/provider недоступен.
- [P2][TODO] **WP30-15 Установить UI performance budget и проверить тяжёлые панели.** Готово, когда: Большие traces, memory tables и Live2D не блокируют input; измерены загрузка, re-render и память браузера.

## Проход 31 — Диагностика, производительность и устойчивость

*Цель: наблюдаемость должна помогать исправлять реальные проблемы, а не становиться самостоятельной коллекцией панелей.*

- [P1][PARTIAL] **WP31-01 Свести структурированные logs/traces к общей схеме correlation.** Готово, когда: Request ID, session ID, runtime cycle, action ID и provider operation связывают журналы между app/gateway/runtime/research bridge.
- [P1][PARTIAL] **WP31-02 Добавить/закрыть error-rate и learning-throughput metrics.** Готово, когда: Метрики имеют единицы, окна агрегации и границы приватности; легко различить failure, refused, unavailable и success.
- [P1][PARTIAL] **WP31-03 Применить общие OpenTelemetry semantic conventions там, где используется OTel.** Готово, когда: Span/metric naming и exception recording согласованы, без внедрения тяжёлой телеметрии, не оправданной локальным deployment.
- [P1][TODO] **WP31-04 Поставить реальные threshold/alerts на health, queue, memory и provider error.** Готово, когда: Thresholds ведут к конкретному runbook-ответу; alert не просто меняет цвет панели.
- [P1][TODO] **WP31-05 Провести многочасовой soak на целевом окружении.** Готово, когда: Измерить RSS/heap/disk/event queues, response latency, errors и state size; выявить утечки и деградацию.
- [P1][TODO] **WP31-06 Нагрузочно проверить concurrency/backpressure/retry storms.** Готово, когда: Пиковые запросы не приводят к неограниченному queue growth, дублированию действий или starvation UI.
- [P1][TODO] **WP31-07 Измерить startup/shutdown/recovery budget.** Готово, когда: Система запускается, завершает активные операции и восстанавливается в зафиксированные сроки без потери данных.
- [P1][PARTIAL] **WP31-08 Провести provider/network/filesystem failure injection в интеграционном сценарии.** Готово, когда: Каждая ошибка имеет ожидаемый safe state, журнал и понятный UI; runtime не зависает навсегда.
- [P2][TODO] **WP31-09 Сформировать профиль CPU/heap для основных пользовательских сценариев.** Готово, когда: Оптимизировать только измеренные hot paths; избегать бездоказательного усложнения алгоритмов.
- [P2][TODO] **WP31-10 Автоматизировать деградированный режим для необязательных подсистем.** Готово, когда: Когнитивный runtime продолжает безопасно работать при недоступности research/LLM/Live2D без фальшивых данных.

## Проход 32 — Установка, упаковка и поддерживаемое развёртывание

*Цель: любой оператор способен воспроизвести установку и запуск без локальных артефактов текущей рабочей машины.*

- [P0][BLOCKED] **WP32-01 Подтвердить npm run install:all на полностью чистом каталоге.** Готово, когда: Зависимости устанавливаются строго по lockfiles, без сохранённых node_modules и глобального vite.
- [P0][TODO] **WP32-02 Зафиксировать поддерживаемые Node/Python/OS combinations.** Готово, когда: Версии закреплены, запускаемые команды совместимы и проверены в целевых системах.
- [P0][TODO] **WP32-03 Собрать production archive из чистого source checkout.** Готово, когда: Архив содержит только необходимые runtime/app/research/assets/docs, манифест, licenses и версии; нет случайных cache/secret/logs.
- [P1][PARTIAL] **WP32-04 Довести one-command production start.** Готово, когда: Команда проверяет config, доступность владельцев, migrations и readiness; exit code отражает фактическую неготовность.
- [P1][PARTIAL] **WP32-05 Завершить version/config/schema migration CLI.** Готово, когда: Каждый migration применим, имеет dry-run/backup/rollback policy и не меняет пользовательские данные неявно.
- [P1][PARTIAL] **WP32-06 Проверить все package scripts и удалить мёртвые/исторически сломанные.** Готово, когда: Canonical commands описаны; команда, которая выглядит release gate, не пропускает обязательную сборку и не выдаёт PASS от unit-only tests.
- [P1][TODO] **WP32-07 Сделать SBOM и license inventory частью release artifact.** Готово, когда: Состав зависимостей/лицензий относится именно к собираемому артефакту и обновляется автоматически.
- [P1][TODO] **WP32-08 Добавить SLSA-style build provenance для final ZIP/bundle.** Готово, когда: Записаны source revision, builder, workflow, dependencies/materials, время и хеши; артефакт можно связать с исходным деревом.
- [P1][PARTIAL] **WP32-09 Сделать воспроизводимый hash/manifest для финального архива.** Готово, когда: Hash формируется после упаковки, включает полный список файлов и фиксирует version/source baseline; манифест не содержит циклическую самоссылку.
- [P1][TODO] **WP32-10 Проверить config profiles dev/research/staging/production.** Готово, когда: Research network выключен по умолчанию; production secrets не наследуются из dev; production ports/hosts/exposed endpoints явны.
- [P1][TODO] **WP32-11 Проверить offline install и повторный запуск после reboot.** Готово, когда: Документация соответствует реальным зависимостям; отсутствие сети объясняется и не вызывает ложного успеха.
- [P2][TODO] **WP32-12 Составить минимальный операторский runbook с recovery decision tree.** Готово, когда: При основных сбоях оператор знает диагностику, backup, restore, rollback и запретные действия без чтения всей истории проходов.
- [P2][TODO] **WP32-13 Проверить license/provenance для всех импортированных исходников и assets.** Готово, когда: Каждая заимствованная реализация имеет лицензионное основание и историю происхождения; неизвестные активные файлы не идут в релиз.

## Проход 33 — Release Candidate и критерии 100% готовности

*Цель: выпускать не потому, что накопилось много PASS-отчётов, а потому что главные пользовательские пути и аварийное восстановление работают в чистом окружении.*

- [P0][TODO] **WP33-01 Создать RC из неизменяемого исходного дерева WorkPass19+.** Готово, когда: Есть commit/tree hash, exact dependency lock, version manifest, changelog и archive checksum.
- [P0][TODO] **WP33-02 Установить RC в чистом окружении и запустить с нулевым state.** Готово, когда: Установка и старт полностью автономны от авторской машины; основные сервисы действительно готовы.
- [P0][TODO] **WP33-03 Пройти critical journey: чат → память → restart → recall.** Готово, когда: Пользовательское сообщение вызывает реальный runtime, сохраняется, восстанавливается и извлекается корректно.
- [P0][TODO] **WP33-04 Пройти critical journey: research → claim verdict → hypothesis/fact policy → conflict.** Готово, когда: Внешние данные не могут стать фактом только по лексическому совпадению/числу источников; conflict корректно ограничивает recall.
- [P0][TODO] **WP33-05 Пройти critical journey: goal → action → external receipt → verified outcome → learning.** Готово, когда: Успех подтверждён независимо, причинная запись/обновление сохраняются, дубль события не удваивает credit.
- [P0][TODO] **WP33-06 Пройти clean upgrade + rollback + restore drill.** Готово, когда: Upgrade старого состояния и полный возврат к предыдущему релизу воспроизводятся по runbook с checksum до/после.
- [P0][TODO] **WP33-07 Завершить browser E2E desktop/mobile + Live2D/fallback.** Готово, когда: Ключевые сценарии проверены настоящим браузером, включая реальные assets, network errors и состояние UI.
- [P0][TODO] **WP33-08 Завершить security sign-off по применимым критериям.** Готово, когда: Нет открытого критического риска; high-risk exceptions перечислены с mitigation/owner и сроком.
- [P0][TODO] **WP33-09 Завершить soak/failure recovery sign-off.** Готово, когда: Нет необъяснённой утечки ресурсов, unbounded queue, потери состояния или двойного внешнего действия.
- [P1][TODO] **WP33-10 Закрыть provider reconnect/remote receipt matrix.** Готово, когда: Провайдерские timeout/429/5xx/auth/network loss и reconnect имеют ожидаемую semantics; remote exactly-once не заявляется без гарантии.
- [P1][TODO] **WP33-11 Синхронизировать README, Architecture, Ownership, Runbook, Changelog и список дел.** Готово, когда: Все версии, entry points, команды, текущий статус и known limitations согласованы; старые численные оценки помечены как historical.
- [P1][TODO] **WP33-12 Подписать release manifest: SBOM, licenses, provenance, hash, rollback package.** Готово, когда: У каждого финального артефакта есть зафиксированное происхождение и доступный проверенный rollback artifact.
- [P1][TODO] **WP33-13 Удалить/закрыть секреты и ненужные исследовательские артефакты из release bundle.** Готово, когда: В архиве отсутствуют реальные credentials, личные runtime states и случайные локальные output; provenance истории остаётся отдельно.
- [P1][TODO] **WP33-14 Подписать final release decision по конкретным acceptance criteria.** Готово, когда: Все P0 закрыты; оставшиеся P1/P2 явно описаны, не маскируются оценкой roadmap percent; решение привязано к точному hash релиза.

## Минимальные release blockers (не переставлять вниз из-за количества задач)

1. Semantic claim verdict (support/refute/mixed/unknown), adversarial topical-match corpus и claim provenance.
2. Доказанный action lifecycle: action → независимый receipt/postcondition → verified outcome → persistence/reafference/learning без двойного credit.
3. Честная оценка MemoryOS2 на независимом temporal holdout + baseline; не объявлять uplift, пока он не подтверждён.
4. Clean install, app typecheck, production Vite build и реальные desktop/mobile browser E2E.
5. Clean-room backup/restore/upgrade/rollback, recovery после corruption и многочасовой soak с ресурсными пределами.
6. Security sign-off, SBOM/licence inventory, artifact provenance, immutable hashes и rollback package.

## Что нужно починить в самом плане работ

- Active `docs/ARCHITECTURE.md` and `contracts/OWNERSHIP.md` are synchronized to runtime 35.45.0; historical reports intentionally retain their original version snapshots.
- Старый список дел содержит исторические totals на 2026-10-06 и append-only статусы. Не суммировать их с новыми таблицами; этот backlog становится рабочим списком, а старую историю пометить как историческую.
- Не использовать roadmap percentage как release readiness. Release-ready определяется только закрытием acceptance gates и явным решением для exact artifact hash.
- Не добавлять новые когнитивные модули, пока существующие не показывают измеримый выигрыш; исследовательские candidates остаются read-only/shadow до promotion.

## Актуальные внешние ориентиры

- LongMemEval-V2, официальный harness/датасет памяти: https://github.com/xiaowu0162/LongMemEval-V2/ — 451 curated questions, 5 memory abilities, large long histories; адаптировать под доступный бюджет и отдельный holdout.
- OWASP ASVS 5.0.0 stable: https://github.com/OWASP/ASVS/releases — использовать для требований к web-app security; не считать прохождение собственной таблицы независимой сертификацией.
- Playwright Browser installation/testing: https://playwright.dev/docs/browsers — source-only smoke не заменяет тест в установленном Chromium/WebKit/Firefox браузере.
- OpenTelemetry Semantic Conventions: https://opentelemetry.io/docs/specs/semconv/ — применять стандартные поля spans/metrics/logs там, где телеметрия нужна для реальных операций.
- SLSA build provenance: https://slsa.dev/spec/v1.0/provenance — фиксировать, что, из чего и каким builder/workflow создано; связать attestations с точным release artifact.

## WorkPass 23 — новые детализированные задачи

1. [P0][DONE] **WP23-01 Безопасная воспроизводимая загрузка NLI-модели.** Immutable SHA commit, safetensors-only, no remote code, exact label contract, bounded local service capacity. Готово по коду; реальный вес не загружен из-за сетевого ограничения среды.
2. [P1][DONE] **WP23-02 Пакетный inference в canonical claim path.** До 24 pairwise NLI сравнений одним запросом/forward pass; single-item backends остаются совместимы.
3. [P0][DONE] **WP23-03 Повторяемый оценщик качества NLI.** Фиксированный labelled JSONL, hash набора, macro/per-class F1, confusion matrix, Brier, cross-entropy и ECE; отчёт не содержит текст утверждений.
4. [P0][TODO] **WP23-04 Реальный NLI holdout.** Установить optional зависимости и pinned model в network-enabled окружении; оценить domain/adversarial holdout без подбора порога на evaluation split.

## Количество задач

- **Всего детализированных изменений:** 185 (исторический baseline 180 + 5 задач WorkPass 23).
- P0: 61; P1: 107; P2: 17.
- TODO: 84; PARTIAL: 89; DONE: 8; BLOCKED: 4.

Этот backlog намеренно не включает уже закрытые возможности как новую работу. Задачи PARTIAL должны продолжать существующие реализации, а не создавать дубли. По завершении каждого прохода статус обновляется по реально изменённому коду, после чего выбирается следующий незакрытый приоритетный проход — без возврата к бесконечным проверкам уже выполненного.


### WorkPass 23 implementation delta — reproducible batched NLI and labelled-holdout evaluation

- **DONE (P0 / WP23-01):** immutable model revision `a150876415327c80daeff35ca6f68f5ed8cf5c24` is pinned by default; mutable branch names are refused, `trust_remote_code=False`, and `use_safetensors=True` prevents pickle-weight fallback. Labels must be exactly entailment/contradiction/neutral.
- **DONE (P1 / WP23-02):** optional `evaluateBatch` is integrated into `ResearchSemanticEntailment`; up to 24 premise/hypothesis pairs are processed by one local tokenizer/model forward pass. Single-pair backend compatibility includes a bounded fallback only for 404/405 batch-route absence; overload, timeout and malformed payload remain fail-closed.
- **DONE (P0 / WP23-03):** `tools/evaluate_research_nli.py` executes a fixed labelled JSONL holdout against the batch endpoint and reports dataset SHA-256, per-class precision/recall/F1, confusion matrix, cross-entropy, Brier score and ECE; source text is excluded from output; remote endpoints require explicit opt-in.
- **DONE (P0 / WP23-06):** detect conservative near-duplicate train/holdout queries with high-overlap token trigrams, and block promotion; the regression proves a trivial trailing-word edit no longer bypasses exact-normalized duplicate detection. Diagnostics preserve only aggregate counts.
- **TODO (P0 / WP23-04):** execute actual pretrained inference and score evaluation on a truly held-out, domain-relevant labelled dataset. Network installs are currently blocked in this sandbox by DNS (`EAI_AGAIN`); no actual model performance or calibration claim is made.
- **Resource control:** NLI service concurrency is bounded; overloaded requests receive HTTP 503 / `Retry-After`, with CPU thread count bounded by environment.
- **Acceptance:** runtime TypeScript PASS; semantic NLI 20 mocked cases PASS; NLI service 9/9 contract cases PASS; evaluator 4/4 loopback/CLI/privacy cases PASS. These prove code contracts, not pretrained model quality.
- **Still open:** app dependency-complete install/Vite build, browser E2E, live HTTPS research, real temporal memory holdout, clean-room restore/rollback, soak and release sign-off.

### WorkPass 22 — next implementation slice status

- **Actual feature delta:** optional local NLI client and server, conservative claim atomization, durable model/provenance validation, mixed/refuted outcome gating.
- **Test delta:** 20 semantic NLI unit cases and 3 service contract cases with mocked model stack; an actual OrganismCore path is also exercised over a loopback HTTP fixture for two-source support, mixed evidence, complete NLI outage and zero positive learning credit. Previous lineage 8, claim evidence 20, idempotency/replay 5 and runtime research gates are retained.
- **Scorecard:** 71.3% weighted implementation roadmap (up from 71.1%, not release readiness); normalized status inventory 68 unique deliverables: 48 DONE, 11 PARTIAL, 9 TODO.
- **Critical gate remains:** no real model quality/calibration claim until the pretrained model is run against a fixed labelled holdout. UI production build/browser E2E and operational release durability remain open.


## WorkPass 24 — operational NLI readiness and revision integrity

1. [P1][DONE] **WP24-01 Разделить liveness процесса и readiness модельного inference.** `/livez` и `/healthz` показывают только возможность ответить на HTTP; `/readyz` возвращает 503, пока модель не загружена. Опциональный `--lazy-model-load` запускает bounded warmup, сохраняя default fail-fast startup. Ошибки показываются только как безопасные коды.
2. [P0][DONE] **WP24-02 Сохранить точную model ID/revision через claim evidence и восстановление.** Revision сохраняется на уровнях atom, quote и aggregate `modelVersions`; модельная смена внутри одной оценки закрывается `unknown`; `ProjectResearchSession.restore` отбрасывает семантические цитаты, revision которых расходится с родительской оценкой. Legacy rows без версии остаются совместимыми.
3. [P0][TODO] **WP24-03 Выполнить настоящее pretrained NLI inference и получить независимые метрики качества.** Загрузить закреплённую модель в network-enabled среде, проверить label mapping и измерить per-class F1, confusion matrix, Brier/ECE/latency на domain-relevant adversarial holdout; не подбирать пороги на holdout. Сейчас registry DNS недоступен, поэтому качество модели не заявляется.

### Acceptance и реальный прогресс WorkPass 24

- **2 новых normalized deliverables закрыты** (G74/G75); суммарный inventory стал 75: 54 DONE, 11 PARTIAL, 10 TODO.
- Semantic NLI integration **23 cases PASS**; Python service **10 tests PASS**; evaluator **4 tests PASS**; Core research gate PASS.
- Memory retrieval benchmark suite passes but candidate remains `not-promoted`: confidence interval admits regression; no external temporal holdout uplift is claimed.
- Production UI build, real model inference, live external providers, clean-room restore/rollback, soak and release sign-off remain open.

## WorkPass 25 — calibration pipeline, evidence provenance и restore validation

- **[P1][DONE] WP25-01 — воспроизводимый private-first temperature-scaling fitter.** `tools/fit_research_nli_calibration.py` использует существующий локальный NLI batch endpoint, не меняет модельные веса и не делает сетевых запросов к внешним адресам по умолчанию. Требует >=50 размеченных примеров на класс, explicit source/labeling protocol, dataset SHA-256, подбирает temperature только на training groups, оценивает NLL/Brier/ECE/accuracy/F1 на детерминированной group-disjoint validation-части и не сохраняет исходные тексты, пишет атомарно с правами 0600, запрещает overwrite и сохраняет `promoted=false`. Тестируется локальным mock endpoint.
- **[P1][DONE] WP25-02 — артефакт калибровки, связанный с точной revision модели и целостностью provenance.** NLI server применяет калибровку только при явном env и проверяет model ID/revision, class order, dataset hash/source/protocol, minimum counts, bounds и fit eligibility. Method/hash/temperature переносятся через atom/quote/aggregate и проверяются при restore; несогласованные/подменённые метаданные закрываются fail-closed.
- **[P0][TODO] WP25-03 — реальные pretrained inference и калибровка.** Не закрыто: registry DNS недоступен; mock-контракты не подтверждают качество. Нужны реальный pinned model run, отдельные calibration и final holdout split, метрики по классам/доменам/языкам/latency.
- **[P0][TODO] WP25-04 — независимый temporal MemoryOS2 benchmark и сравнение с BM25.** Синтетический/текущий интервал всё ещё допускает регрессию; автоматическое продвижение запрещено.
- **[P0][TODO] WP25-05 — dependency-complete UI build и реальные browser E2E.** Установка Vite/dependencies заблокирована DNS; не считать linkage-аудит эквивалентом браузерного продукта.

### Acceptance WorkPass26

- Runtime TypeScript compiler PASS; semantic claim integration 23 cases, service 12/12, evaluator 4/4, calibration fitter 5/5; research/Core/idempotency/recovery gates PASS.
- 2 новых normalized deliverables закрыты: G76/G77; текущий status inventory — 77: 56 DONE, 11 PARTIAL, 10 TODO.
- Runtime 35.48.0, schema 224; weighted roadmap 72.00% (+0.15 п.п. от WorkPass24), не является release readiness.
- Реальные веса, calibration/holdout и production UI build не запускались/не прошли в текущем окружении; выпуск не сертифицирован.

## Актуальные счётчики backlog WorkPass25

- **Всего детализированных изменений:** 190 (188 на WorkPass24 + 2 пункта WorkPass25).
- P0: 63; P1: 110; P2: 17.
- TODO: 85; PARTIAL: 89; DONE: 12; BLOCKED: 4.

Сохранять этот документ как канонический backlog в Library: `/Нейро Курису/Neuro_Kurisu_FULL_RELEASE_BACKLOG_CANONICAL.md`; после каждого прохода обновлять каноническую копию и версионированный снимок.



### WorkPass 27 implementation delta — retrieval candidate coverage and real BM25 baseline (13.10.2026)

- **DONE (implementation correction):** `MemoryOS2` no longer truncates every token posting list to the first 96 memory IDs. The existing corpus remains capped at 1600 records, while each token index retains all of its in-corpus matches. Candidate collection is still capped at 192 rows per query.
- **DONE (candidate quality plumbing):** candidate priority now combines inverse-document-frequency support, matched-query-term coverage, exact phrase, temporal validity, revision sequence, last-access recency, salience and stable ID tie-breaks. This preserves deterministic selection while preventing high-fanout postings from hiding a better match solely due to insertion order.
- **DONE (semantic score correction):** orthogonal/negative hashed-token cosine vectors no longer receive an artificial 0.5 similarity baseline; unrelated candidate pairs contribute no positive cosine similarity. Identical vectors remain 1.0.
- **DONE (benchmark comparator):** replaced the binary query-token-overlap baseline with actual corpus-scoped Okapi BM25 (`k1=1.2`, `b=0.75`, unique query terms), explicitly excluding expired/future, dormant and quarantined records at the fixed evaluation time. Reports include tokenizer/corpus scope, document count, average document length and a baseline-configuration SHA-256. Multi-seed experiment signatures include this configuration fingerprint.
- **Regression evidence:** on the existing 8-query synthetic holdout, MemoryOS2 is behind BM25 by 0.25 Recall@5; paired bootstrap interval is [-0.75, 0.25]. This is a small fixture, not a production estimate, but it correctly blocks promotion and highlights the next algorithmic problem to solve.
- **Still open:** tune/rework hybrid scoring only against train queries, preserve a frozen independent temporal holdout, run both systems there with recall/MRR/latency/false-recall analysis, and require a stable confidence-bounded result before promotion. React/Vite production build and browser/Live2D E2E remain release blockers.


### WorkPass 28 implementation delta — single-digit numeric retrieval correction (13.10.2026)

- **DONE (retrieval correctness slice):** canonical MemoryOS2 tokenization retains standalone single-digit numbers in addition to Unicode terms of length >=2. This allows status codes, one-digit measurements/ratings and short numeric values to participate in candidate selection and lexical/vector scoring; one-letter words remain excluded.
- **DONE (baseline parity):** the offline Okapi BM25 evaluator uses the same tokenization contract. Algorithm/tokenizer version is now part of the retrieval-configuration fingerprint, so a code-level ranking change cannot silently reuse the previous fingerprint.
- **DONE (regression coverage):** English numeric-status and Russian numeric-measurement queries return the expected record; expired memory remains excluded in current mode; candidate coverage/order and temporal inspector tests continue to pass.
- **Corrected interpretation of WorkPass27 benchmark:** its `-0.25 Recall@5` was confounded by dropping standalone one-digit terms in both the candidate and test baseline. With the fixed tokenizer, the 8-query synthetic fixture reaches `1.00` candidate Recall@5 and `1.00` BM25 Recall@5 (delta `0.00`, paired **Recall** interval `[0.00, 0.00]`). This is parity on a small synthetic fixture, not an uplift or production estimate; automatic promotion remains disabled.
- **Still open:** independent human-labelled temporal holdout on long-dialogue memories, no-leakage review, Recall@k/MRR/latency/false-recall comparison, frontend production build/browser Live2D E2E, and remaining release durability gates. No normalized release deliverable is marked closed by this partial retrieval correction.


## WorkPass 29 — глубокая интеграция Memo × MemoryOS2 × Hexis (2026-10-13)

- Исправлено восстановление canonical content indexes: после загрузки snapshot активная/последняя revision выбирается по временной валидности, статусу, revision sequence и observation time, а не по случайному порядку строк. Возврат к прежней формулировке больше не заставляет старую expired-строку перехватывать `contentIndex`.
- `reviseContent` стал lineage-aware: одинаковый текст — no-op без self-supersede; изменённый текст получает стабильный ID в контексте цепочки и revision sequence, даже если такая формулировка ранее встречалась. Коррекция, вызванная по historical ID, направляется на актуальный tip той же цепочки.
- Повторное наблюдение для content, существующего только в expired/historical состоянии, не перезаписывает historical ID и его validity boundary.
- Добавлены read-only `MemoryOS2.temporalAt()` / `temporalDiff()`. Hexis temporal lookup/diff теперь проецирует canonical MemoryOS2 timeline; собственные Hexis temporal rows остаются audit/export projection, не источником истины.
- Исправлены выборки Hexis: Memory Index отдаёт актуальные записи, синхронизация ограничивает и упорядочивает недавнюю историю, а default learning review берёт до 12 самых недавно затронутых live memories вместо старейшего хвоста newest-first списка. Explicit memory IDs остаются доступными для ревью истории.
- Починен dedup-index при вытеснении/forgetting: после удаления старой записи ключи повторно выбирают лучшую из оставшихся записей, а не стирают ссылку на актуальный дубль. Добавлен регрессионный сценарий заполненного корпуса на 1600 записей, где вытесняется истёкшая копия.
- Добавлен `tests/memory-source-integration-workpass29.mjs` с regressions для snapshot/restore, повторного использования старой формулировки, no-op revisions, переизвлечения expired content, безопасного индексирования после capacity eviction, canonical Hexis temporal delegation и отбора свежих элементов на ревью.
- **Проверки:** runtime typecheck, temporal inspector closure, candidate coverage, numeric retrieval, R15/R16 behavior и integration regression проходят. Внешний root audit и production browser/Live2D E2E проверяются отдельно; этот проход не утверждает release readiness или retrieval-quality uplift.
- **Открыто:** независимая labelled temporal holdout против BM25, React/Vite production build и browser E2E, real NLI inference, clean-room recovery/rollback, soak и release sign-off.


### WorkPass 30 implementation delta — unified source provenance in canonical MemoryOS2 (13.10.2026)

- **DONE (G80 / provenance seam):** introduce `MemoryEvidenceSource` entries inside the sole canonical `MemoryOS2` memory record. At most eight independent lineages remain visible; a compact 32-key lineage guard prevents an old lineage trimmed from the visible trail from being counted as novel when replayed. Provenance participates in byte estimation and snapshot/restore normalization.
- **DONE (research integration):** `OrganismCore.integrateExternalResearchMemory` passes EvidenceFirewall/ProjectResearchSession-derived `sourceLineageKey` into the canonical evidence trail; the serving publisher/host is retained as the source label. Same-story mirrors are one independence vote even across hostnames; a genuinely independent lineage merges into the existing canonical content instead of creating a competing memory.
- **DONE (confidence and diagnostics):** repeat ingestion of a known lineage cannot ratchet confidence upward; only a newly observed independent lineage retained in the bounded trail may contribute one capped corroboration update. Read-only `evidenceTrail`, `inspectRecent` and `statsLight` expose lineage accounting through the existing Runtime Atlas API projection.
- **DONE (integration regression):** executable OrganismCore-to-MemoryOS2 bridge test covers two URLs in one syndicated family plus a distinct family, mirror provenance, snapshot/restore, trail bounds, replay protection and byte estimate stability.
- **Not claimed:** source-lineage completeness, semantic entailment or retrieval-quality uplift. Synthetic Recall@5 remains at BM25 parity; independent labelled temporal holdout, real pretrained NLI inference/provider run, production UI/browser Live2D E2E, clean-room rollback/soak and release sign-off remain open.


## WorkPass 32 — hybrid retrieval with fuzzy lexical candidate discovery

- **DONE (implementation slice):** canonical MemoryOS2 maintains a token-level character-trigram inverted index and uses it to discover spelling variants and inflections before the existing 192-candidate bound. Index postings are maintained across encode, forget, capacity eviction and restore.
- **DONE (implementation slice):** rank fusion combines BM25, exact query-token coverage, fuzzy character similarity, entity overlap and graph/temporal relationship evidence. Rank lists ignore zero-score candidates. The 48-dimension hashed token projection no longer contributes as though it were semantic embedding evidence.
- **DONE (integration):** Runtime score fusion redistributes the unavailable embedding channel weight to actual match-quality signals; diagnostics report `semanticEmbeddingProvider=none` and `semanticVectorUsedForRanking=false`.
- **Still open:** genuine local embeddings/cross-encoder reranking, independent labelled temporal holdout, production frontend build/browser Live2D E2E and final release durability remain unverified. Synthetic typo/inflection regressions are useful code acceptance only; retrieval promotion remains blocked.


## WorkPass 34 implementation delta — 13.10.2026

- **DONE (implementation):** optional local semantic retrieval is connected to the normal `OrganismCore.observe` path via the canonical `MemoryFabric`; selected semantic results can affect the memory context actually consumed by cognition when explicitly enabled.
- **DONE (latency/fallback implementation):** foreground wait is bounded (220 ms default, 50–1000 ms configurable); the immediate canonical BM25/fuzzy result is retained on slow provider or errors; one in-flight semantic warm-index job per fabric; batch requests have a total deadline across chunks.
- **DONE (acceptance, not quality promotion):** focused runtime audit and root `audit:workpass34` pass, including release metadata/contracts, UI/API linkage, browser-smoke verdicts, provider and fallback integration.
- **PARTIAL (real model):** fixture-backed tests prove the call path and fallback but not real Ollama/llama.cpp inference, target-machine latency/RAM, or retrieval uplift. Independent labelled temporal holdout, production Vite/browser Live2D E2E, clean-room rollback/soak and release sign-off remain open.
- **Next implementation:** fuse semantic and lexical top-K rather than blindly replacing the candidate list; add a bounded model/revision-keyed query-vector cache and cancellation of stale requests; keep opt-in until real-model and holdout evidence support promotion.
