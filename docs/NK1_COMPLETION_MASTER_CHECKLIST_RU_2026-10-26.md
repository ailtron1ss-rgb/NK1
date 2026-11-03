# NK1 / Neuro Kurisu — единый мастер-чеклист завершения
Дата фиксации: 2026-10-26  
Источник состояния: `ailtron1ss-rgb/NK1`; рабочие исходники/интеграция отделены от публикационной линии `main`.  
Базовая точка для этого документа: ветка `work/hexis-evidence-adapter-2026-10-26`, HEAD `2c2552f9702a3b8e2c4834f68101ee7d8e29273a`. Это план работ, а не доказательство выполнения пунктов.

## Правила ведения
- `[ ]` открыто; `[~]` реализация частичная либо факт требует проверки; `[x]` только после проверяемого артефакта и привязанного SHA/CI или полевого протокола.
- Статус не переносить на новый HEAD только потому, что тест прошёл на старом коммите. Указывать тестируемый SHA, run URL, окружение и область доказательства.
- Изменения кода — небольшими логическими коммитами `[NK1][этап]`; обязательны regression, CHANGELOG и краткая запись в tracker. Не писать PASS, пока результат не получен.
- `main`/Release ZIP считать каналом публикации, не каноническим источником исходников. Не заявлять релиз обновлённым без пересборки, manifest и SHA-256.
- Не создавать второй brain, второй memory owner, параллельный ActionGateway или отдельного learner ради интеграции внешнего проекта. Сначала адаптировать в существующий контракт.
- Не называть субъективное сознание, человеческие эмоции или общую интеллектуальность доказанными. Оценивать только наблюдаемое поведение и независимые задачи.
- Для автономности отделять read/think/draft от внешних побочных действий; полномочия, EthicalGate и проверяемый receipt обязательны.

## Сводка исходной точки
- `main` — публикационная линия; исходное дерево развивается в отдельной ветке. GitHub сообщает об отсутствии общего предка `main` и `workpass70-source`; массовое слияние запрещено без отдельной миграционной стратегии.
- В README описан WorkPass70 Hotfix 1 от 2026-10-19: app scripts 229/229, speech timeline 11/11, app/runtime typecheck и Vite dev build PASS для указанной сборки.
- Это не подтверждает production build, миграции БД, browser/Live2D E2E, физический Android/Termux audio, длительный soak, независимый retrieval uplift или полный license review.
- Tracker на 2026-10-26 содержит 12 направлений; текущие веса релизной готовности по нему дают около 35/100, внешние доказательства около 17/100 (расчёт по значениям tracker, не измерение интеллекта).
- Learning scorecard: overall learning engineering 57/100, P23 symbolic core 61%, evidence-grounded maturity 36%, lifelong-learning roadmap 30%; uplift не заявлен.
- Tracker JSON старше части текстовых записей: текст описывает WorkPass375/376, JSON ещё фиксирует WorkPass356/старый проверенный SHA. Синхронизировать, не подменяя исторические тестовые SHA.
- Последняя известная Hexis-ветка содержит код адаптера и MemoryOS2 bridge, но exact-head typecheck/tests/integration/release verification для WorkPass375/376 ещё требуют подтверждения.
- Текущий канонический релизный ZIP не содержит автоматически последующие изменения; опубликованный архив считается устаревшим, пока не пересобран и не сверён.

## Этап A — каноническая база, Git и прослеживаемость
- [ ] A01. Получить live metadata репозитория: default branch, permissions, последнюю дату коммита и release tag.
- [ ] A02. Снять полный список веток, SHA, возраст, upstream/base, open PR и merge status.
- [ ] A03. Построить граф зависимостей PR; определить безопасный порядок слияния стеков.
- [ ] A04. Сравнить каждый активный PR с его base и проверить, какие изменения уже входят в интеграционную ветку.
- [ ] A05. Для каждого PR зафиксировать область изменений, владельца состояния, тестовый контракт и критерий отказа.
- [ ] A06. Сохранить полезные ветки-источники до портирования; не удалять их по одному только числу коммитов или возрасту.
- [ ] A07. Разрешить конфликт историй `main`/source через явный release synchronization plan; не делать blind merge/cherry-pick сотен коммитов.
- [ ] A08. Выбрать один канонический integration branch и один конкретный candidate SHA для финального набора изменений.
- [ ] A09. Все изменения проверять относительно exact HEAD, а не только базового коммита или ветки похожего названия.
- [ ] A10. Устранить разночтения WorkPass-номеров, SHA, статуса и дат в README, CHANGELOG, tracker JSON/MD и handover.
- [ ] A11. В tracker разделить implementation, tests authored, exact-head validation, external evidence и release readiness.
- [ ] A12. Добавить проверку непротиворечивости tracker: тестовый SHA должен соответствовать конкретному run и файлам.
- [ ] A13. Добавлять явные статусы `implemented / tested / field-verified / release-approved`, не объединяя их.
- [ ] A14. Проверить PR заголовки/описания, где draft/unmerged/merged статус или план уже устарели.
- [ ] A15. Установить правило отдельного коммита для каждой логической правки; не смешивать план, runtime, миграцию и UI в одном гигантском commit.
- [ ] A16. До релиза определить rollback-точку интеграционной ветки и способ вернуться к последнему проверенному состоянию.
- [ ] A17. Составить список дублирующих/осиротевших модулей, импортов и тестов; каждое удаление подкреплять графом импортов и тестами.
- [ ] A18. Проверить, что новая документация не маскирует отсутствие кодовой интеграции или живой проверки.
- [ ] A19. Хранить точные ссылки на commits, PR, workflow runs, artifacts и release asset для каждого завершённого P0.
- [ ] A20. Установить финальный критерий: ни один обязательный blocker не может иметь статус «неизвестно» при production approval.

## Этап B — входные контракты, события, receipts и целостность состояния
- [ ] B01. Прогнать инвентаризацию всех публичных runtime ingress: actions, cognitive events, observations, tool receipts, evaluation reports, restore snapshots.
- [ ] B02. Для каждого ingress зафиксировать schema, размер, допустимые типы, права, idempotency key и собственника состояния.
- [ ] B03. Исключить вызов caller-controlled getters/accessors и coercion на границах untrusted input.
- [ ] B04. Отклонять неизвестные ключи, symbol keys и неожиданные прототипы там, где контракт строгий.
- [ ] B05. Проверять идентификаторы без lossy truncation; отказывать на control chars до trim, нормализации и вычисления ключа.
- [ ] B06. Единообразно обрабатывать C0/DEL/C1, Unicode NFKC, padded IDs, пустые строки и лимиты длины.
- [ ] B07. Для повторного trace ID сравнивать весь identity-relevant payload; одинаковый retry — no-op, другая запись — явный conflict.
- [ ] B08. Проверить дедупликацию после bounded eviction и после snapshot/restore.
- [ ] B09. Ограничить не только отдельную строку, но и суммарный размер ключей/строк/вложенных элементов payload.
- [ ] B10. Проверить finite числовые показатели, confidence [0,1], bounded counters, ticks, timestamps, hashes и revision IDs.
- [ ] B11. Изменение ledger, replay index, receipt index и цикла проводить атомарно; ошибка не должна оставлять полусостояние.
- [ ] B12. Restore строить off-ledger, валидировать весь snapshot, затем менять состояние одной транзакционной операцией.
- [ ] B13. Проверить конфликтующие дубликаты NFKC при восстановлении; точные дубликаты свернуть, противоречивые — quarantine.
- [ ] B14. Не доверять caller-asserted provenance/grounding/verified booleans; получать доверие из канонического runtime receipt/внешнего verifier.
- [ ] B15. Связать outcome с decision tick, action input, environment, task/run/seed и реальным observed postcondition.
- [ ] B16. Проверить expiry, архивирование, retired evidence, superseded memories и повторный импорт удалённой/архивной записи.
- [ ] B17. Протестировать SIGKILL между acceptance, ACK, persistence, output и receipt commit.
- [ ] B18. После restart/reconnect проверять reconciliation, duplicate replay, read-after-write и конечный verified state.
- [ ] B19. Сделать fault-injection по malformed proxy/getter, disk-full, permission error, partial write, corrupt JSON и lock contention.
- [ ] B20. Каждое P0-исправление связать с живым тестом и workflow path filter; проверить, что тест реально исполняется в CI.
- [ ] B21. Обеспечить диагностические логи без секретов: rejected contract, trace ID, cause code, no mutation assertion.
- [ ] B22. Сверить event schema migrations с текущими persisted snapshots и архивными форматами.
- [ ] B23. Проверить bounded dedupe, индексы и snapshots под высоким числом событий и многочасовым replay.
- [ ] B24. Зафиксировать exact-head typecheck плюс regression suite как минимум для каждой публичной boundary-группы.
- [ ] B25. Критерий: все некорректные ingress завершаются fail-closed и не меняют ни один ledger/индекс.

## Этап C — единый когнитивный runtime
- [ ] C01. Нарисовать фактический call graph от perception до результата действия; подтвердить путями исходников, а не только схемой.
- [ ] C02. Оставить один главный владелец оперативного состояния и один контрактный event bus.
- [ ] C03. Запретить прямые cross-module imports в обход согласованного bus/контрактов там, где применяется архитектурное правило.
- [ ] C04. Проверить полный порядок Perceive → Appraise → Plan → Act → Reflect → Consolidate.
- [ ] C05. Синхронизировать timestamps, tick counters, current world state и snapshot sidecar.
- [ ] C06. Тестировать future/old tick, time reversal, missed tick и duplicate tick.
- [ ] C07. Связать UnifiedCognitiveSubstrate с настоящим OrganismRuntime без второго action owner.
- [ ] C08. Убедиться, что optional work не блокирует критический цикл и имеет budget/deadline/cancel.
- [ ] C09. Определить поведение цикла при нулевых стимулах, нехватке ресурсов, противоречивых целях и недоступных сервисах.
- [ ] C10. Проверить, что cycle output порождает реальные наблюдаемые решения, а не только self-report/debug trace.
- [ ] C11. Проверить state continuity на 10 000 deterministic ticks/seed, фиксируя редкие нарушения порядка.
- [ ] C12. Измерить p50/p95/p99 latency и RAM на PC и целевом телефоне.
- [ ] C13. Проверить event backpressure, очередь, отмену, shutdown и drain.
- [ ] C14. Тестировать restart/re-init после каждого этапа цикла; состояние должно восстановиться по определённой политике.
- [ ] C15. Проверить взаимную согласованность эпизодической памяти, world model, goals, self-model и affect state после restore.
- [ ] C16. Добавить end-to-end test на реальном LLM/provider, отличающий его от fake/mock smoke.
- [ ] C17. Проверить timeout/circuit breaker/retry budget и изоляцию разных providers.
- [ ] C18. Проверить model switch и fallback без сброса идентичности или памяти.
- [ ] C19. Вынести доступные health/diagnostic summaries для каждого core subsystem.
- [ ] C20. Критерий: единый повторяемый когнитивный цикл сохраняет корректность при нагрузке, прерываниях и перезапусках.

## Этап D — память, поиск, время и консолидация
- [ ] D01. Инвентаризировать все существующие memory stores/APIs и назначить канонического владельца каждому типу памяти.
- [ ] D02. Устранить дублирующие memory writers/learners; старый код держать только как архив до миграционного решения.
- [ ] D03. Согласовать рабочую, эпизодическую, семантическую, процедурную и стратегическую память с текущей архитектурой.
- [ ] D04. Стандартизировать provenance: source, source class, timestamp, context, confidence, independence key, evidence digest.
- [ ] D05. Проверить временную валидность фактов, revisions, supersession, valid-from/valid-until и точечные запросы «на момент времени».
- [ ] D06. Проверить запись полного диалога/опыта с разграничением пользовательского факта, гипотезы модели и внешнего наблюдения.
- [ ] D07. Проверить retrieval по semantic, temporal, exact entity, relation, task relevance и contradictions.
- [ ] D08. Не позволять поиску прогревать cold vectors/менять residency только из-за запроса на чтение.
- [ ] D09. Сохранить ограниченный бюджет кандидатов; проверить off-by-one, graph expansion и bounded latency.
- [ ] D10. Установить целевую производительность поиска ≤30 мс на 10k записей на объявленном целевом устройстве или документировать реалистичную поправку.
- [ ] D11. Проверить embeddings: модель, локальный provider, version, normalization, dimension, fallback и reproducibility.
- [ ] D12. Включить retention/decay/forgetting, архивирование и контролируемое восстановление удалённого/устаревшего факта.
- [ ] D13. Проверить консолидацию после сна/простоя и исключить promotion на caller-trusted/ungrounded evidence.
- [ ] D14. Проверить идентичную дедупликацию доказательств и конфликт одинакового ID с разным digest.
- [ ] D15. Проверить независимость источников: два зеркала одного текста не должны считаться двумя независимыми подтверждениями.
- [ ] D16. Защитить sensitive/protected memories review gate; обычный import не может снимать защиту.
- [ ] D17. Создать замороженный независимый RU/EN corpus с answerable/unanswerable, временными изменениями и противоречиями.
- [ ] D18. Измерить Recall@k, precision, MRR/NDCG или эквивалентные подходящие показатели, unsupported retrieval и abstention.
- [ ] D19. Сравнить baseline/candidate на ≥5 paired seeds и хранить per-case результаты, интервалы и конфигурации.
- [ ] D20. Дополнить retrieval benchmark многоходовыми задачами «вспомнить → решить → проверить действие», а не только точным поиском.
- [ ] D21. Измерить retention после process-kill/restart, model switch, budget pressure и длинного перерыва.
- [ ] D22. Сравнить replay/consolidation стратегиями на одном task/seed/budget, включая забывание и negative transfer.
- [ ] D23. Не продвигать память-кандидат, если recallDelta статистически неустойчив или ухудшается abstention/ложное извлечение.
- [ ] D24. Сохранить аудит памяти: кто записал, что изменил, на каких свидетельствах и по какой политике.
- [ ] D25. Критерий: независимые данные демонстрируют положительное и устойчивое качество памяти; `recallDelta=0` закрыт, а не скрыт сменой метрики.

## Этап E — Hexis assimilation / evidence lineage
- [ ] E01. Уточнить исходный upstream Hexis: QuixiAI, Bevel-Software и hexis-framework — разные проекты и не смешивать их.
- [ ] E02. Зафиксировать конкретные upstream revision, license, notices, dependencies и происхождение адаптируемых идей/фрагментов.
- [ ] E03. Составить mapping «механизм Hexis → существующий владелец NK1 → интерфейс → миграция → тест → решение».
- [ ] E04. Проверить strict schema HexisEvidenceAdapter: identities, stance, timestamp, finite confidence, note/source limits.
- [ ] E05. Проверить rejection unknown keys, symbol keys, accessors, hostile proxies, malformed prototype и throwing dedupe-index.
- [ ] E06. Проверить control characters C0/DEL/C1 во всех текстовых provenance fields; регрессия должна доказывать отказ без вызова getters.
- [ ] E07. Проверить canonical timestamp policy: timezone required, parse strictness, round-trip и invalid calendar dates.
- [ ] E08. Проверить identity key scope: evidence ID, memory ID, canonical composite key и collision/conflict semantics.
- [ ] E09. Проверить, что адаптер не меняет belief confidence, не повышает trust и не продвигает навыки сам.
- [ ] E10. Проверить protected-memory route и прохождение в существующий review flow.
- [ ] E11. Проверить запись через канонический MemoryOS2 и отсутствие параллельной базы/ledger.
- [ ] E12. Проверить digest, provenance class, independence key, source ref, timestamp, stance и confidence сохраняются после restore.
- [ ] E13. Проверить supports/contradicts/contextualizes на одном факте с несколькими независимыми и зависимыми источниками.
- [ ] E14. Связать сохранённую evidence history с существующим belief appraisal/review API, не обходя approve gate.
- [ ] E15. Проверить duplicate retry, conflicting digest, retired evidence и повторную загрузку после rollover.
- [ ] E16. Запустить focused adapter test + bridge test + runtime typecheck на одном exact SHA.
- [ ] E17. Включить оба теста в unified cognitive integration и проверить path filters.
- [ ] E18. Обновить CHANGELOG и tracker только после CI; оставить score неизменным без benchmark uplift.
- [ ] E19. Не подключать отдельный Hexis service/database/credentials, пока измерения и схема не оправдывают это.
- [ ] E20. Критерий: Hexis-inspired evidence непрерывно проходит от ingress к канонической памяти и review, сохраняя lineage и все NK1 safety gates.

## Этап F — continual learning, Hermes и навыки
- [ ] F01. Сопоставить P23/P26/P29/P32/P34 и learner owners; определить единственный путь обновления политик/навыков.
- [ ] F02. Связать наблюдаемый исход задачи с предварительным планом и конкретным действием через trusted receipt.
- [ ] F03. Проверить, что rewards, confidence и caller-supplied scores не являются доказательством результата.
- [ ] F04. Выполнить аудит всех external learning intake call sites и удалить неавторитетные grounding flags из trust decisions.
- [ ] F05. Сохранить deterministic experiment manifest, paired seeds, task family, plan fingerprint, task input fingerprint и split identity.
- [ ] F06. Проверить leakage между train, validation и immutable holdout.
- [ ] F07. Проверить независимые task families и минимум distinct tasks прежде, чем вычислять продвижение.
- [ ] F08. Выполнить базовые ablations: no-learning, replay-only, candidate, candidate+replay, policy-only.
- [ ] F09. Измерять task success, trajectory quality, regret, retention, transfer, calibration, safety violations и compute cost.
- [ ] F10. Протестировать отрицательный перенос, forgetting, catastrophic regression и skill expiry/decay.
- [ ] F11. Завершить цикл ошибки → diagnosis → repair proposal → validation → holdout → verifier → approval → staged activation.
- [ ] F12. Разделить создать кандидата, проверить, одобрить и активировать: одна функция не должна автоматически выполнять все четыре.
- [ ] F13. Проверить signed evidence canonicalization, trusted key identity, signature encoding, replay protection и candidate payload binding.
- [ ] F14. Проверить durable candidate store CAS, process restart, stale revision, multi-process contention и rollback.
- [ ] F15. Связать реальный host-owned sandbox, verifier и scanner; исключить общую административную власть/self-attesting functions.
- [ ] F16. Проверить timeout, cancellation, orphan process cleanup, restricted environment и отсутствие утечки secrets.
- [ ] F17. Сравнить skill candidate с baseline на matching tasks/seeds и требовать устойчивого прироста без family regressions.
- [ ] F18. Для локальной модели проверить real inference и генерацию candidate; fake-provider smoke не засчитывать как качество модели.
- [ ] F19. Версионировать промпты, инструменты, skill files, dependencies и provenance; определить rollback в один шаг.
- [ ] F20. Критерий: улучшение переносится на независимые задачи и сохраняется после restart; без этого skill promotion остаётся заблокированным.

## Этап G — motivation, affect, autonomy и temporal continuity
- [ ] G01. Инвентаризировать IntrinsicMotivationEngine, endogenous goal genesis, EILS/homeostasis, affect state и autonomous scheduler.
- [ ] G02. Привязать внутренние потребности, стресс, любопытство и уверенность к общему tick/state, не создавая параллельную шкалу мотивации.
- [ ] G03. Определить observable meanings/units/ranges каждой переменной и правила decay/smoothing.
- [ ] G04. Проверить генерацию собственных целей из нерешённых задач, прогноза, памяти, ошибок и потребностей.
- [ ] G05. Для каждой инициативы записывать trigger, observed state, chosen goal, rejected alternatives, budget, safety decision и outcome.
- [ ] G06. Измерять полезность инициативы человеком/независимым evaluator на скрытом наборе сценариев.
- [ ] G07. Проверить отсутствие prompt: organism должен сам начать допустимую работу по internal trigger; отдельно считать trigger и реальное полезное действие.
- [ ] G08. Проверить heartbeat после quiet period, пропусков scheduler и позднего resume.
- [ ] G09. Связать `time_since_last_interaction` с выбором режима и приоритета, но не превращать в навязчивую рассылку.
- [ ] G10. Ограничить автономный budget по времени, CPU/RAM, токенам, числу действий и риску побочного эффекта.
- [ ] G11. Ввести остановку/отдых, backoff, cooldown, interrupt priorities и предотвращение бесконечных циклов.
- [ ] G12. Проверить конкурирующие цели, конфликт целей с пользовательским запросом и смену приоритета после нового события.
- [ ] G13. Проверить эмоциональную динамику на последовательности событий, не только единичные фикстуры.
- [ ] G14. Сохранять настроение/отношение как изменяемый контекст с доказательствами и ограничениями, а не как фиксированный label.
- [ ] G15. Проверить характер Kurisu: интеллект, сарказм, независимость и воля в разных режимах общения без поломки полезности/этики.
- [ ] G16. Проверить повторяемость поведения на одинаковых seeds и разнообразие решений на неоднозначных сценариях.
- [ ] G17. Проверить кризисные состояния: провайдер недоступен, нехватка ресурсов, конфликт памяти, неверное предсказание.
- [ ] G18. Проверить автономные действия с побочными эффектами: draft/read допускается политикой, внешняя запись/send/command требует полномочий.
- [ ] G19. Запустить длительный автономный soak с измерением полезных действий, пустых циклов, ошибок, затрат и безопасных отказов.
- [ ] G20. Критерий: есть воспроизводимая инициативность ≥ требуемого проектом порога; каждое решение объяснимо через реальный internal state и безопасный budget.

## Этап H — SelfModel, UserModel, ToM и ethical boundaries
- [ ] H01. Инвентаризировать IdentityContinuity, SelfModelV2, world identity/causal self, autobiographical continuity и personality dynamics.
- [ ] H02. Определить каноническую модель идентичности/биографии и не позволять разрозненным моделям противоречить друг другу.
- [ ] H03. Подключить self-model к возможностям, планам, уверенности, прогнозам и ретроспективной оценке.
- [ ] H04. Проверить memory-grounded claims о прошлых событиях; не допускать ложных воспоминаний на основании self-report.
- [ ] H05. Подключить UserModel/ToM к ответам и планированию, не фиксируя неподтверждённые предположения о пользователе как факты.
- [ ] H06. Добавить confidence/knowledge-gap и trigger на запрос уточнения либо дополнительное наблюдение.
- [ ] H07. Проверить влияние моделей на разные response modes: деловой, эмоциональный, инициативный, voice/live avatar.
- [ ] H08. Проверить этику и privacy в каждом tool path: чтение, запись, отправка, удаление, выполнение команд.
- [ ] H09. Проверить prompt injection из памяти, документов, веб-страниц, tool outputs и импортированного Hexis evidence.
- [ ] H10. Убедиться, что внешнее свидетельство не может менять protected memory без review.
- [ ] H11. Разделить request/intent/approval/action/external postcondition, чтобы output не сообщал несуществующий результат.
- [ ] H12. Добавить матрицу полномочий и проверять на каждом boundary, включая restore и retry.
- [ ] H13. Тестировать неверную уверенность, несогласие источников, ambiguity, stale facts и отсутствие информации.
- [ ] H14. Проверить privacy/deletion export: удалённые данные не воскресают из индексов, snapshots или архива при restore.
- [ ] H15. Проверить, что отказ безопасен, понятен и допускает корректный альтернативный маршрут.
- [ ] H16. Критерий: self/user models реально влияют на выбор и калибровку ответов, но не расширяют права и не подменяют доказательства.

## Этап I — world model, perception и external grounding
- [ ] I01. Инвентаризировать внешние наблюдения, устройства, browser/tool outputs и доступные сенсорные adapters.
- [ ] I02. Для каждого observation фиксировать источник, время, validity, schema и уровень доверия.
- [ ] I03. Проверить causal world ticks и единую идентичность наблюдаемого события.
- [ ] I04. Проверить модель мира на multi-step задачах, где правильный ответ зависит от нескольких состояний и времени.
- [ ] I05. Разделить наблюдаемое, предсказанное, симулированное и производное состояние.
- [ ] I06. Проверить prediction error → appraisal → belief update/review → new plan.
- [ ] I07. Проверить, что mock/simulation evidence не маркируется как реальное device evidence.
- [ ] I08. Подключить реальные actions только через ActionGateway, с корректным tool registry и permission scope.
- [ ] I09. Для каждого инструмента определить schema, side effects, timeout, cancellation, retry/idempotency и verifier.
- [ ] I10. Проверить реальный postcondition, а не только HTTP 200/ACK.
- [ ] I11. Провести отказ провайдера после принятия команды, но до подтверждения результата.
- [ ] I12. Проверить reconnect/reconcile, чтобы система не повторяла опасное действие без необходимости.
- [ ] I13. Проверить фальшивый success, stale receipts, wrong run ID и response mismatch.
- [ ] I14. Измерить реальную задержку между perception, decision, action и verified result.
- [ ] I15. Критерий: модель мира используется в настоящем цикле и корректирует поведение по внешним, проверенным последствиям.

## Этап J — Live2D/2.5D avatar, animation и voice
- [ ] J01. Провести инвентаризацию canonical asset manifest, Live2D models, sprites, expressions, motion files и legacy duplicates.
- [ ] J02. Проверить лицензию, источник и хэш каждого внешнего артефакта; не добавлять неподтверждённые чужие модели в релиз.
- [ ] J03. Сохранить текущую модель и реализовать отдельный selectable вариант Kurisu 2.5D.
- [ ] J04. Проверить UI toggle, persistence выбора и fallback, если модель отсутствует или не загрузилась.
- [ ] J05. Проверить, что switching avatar не сбрасывает personality/memory/cognitive runtime.
- [ ] J06. Согласовать versioned embodiment intent contract между cognition, avatar и voice.
- [ ] J07. Сопоставить affect state с expressions/motions/poses без нелогичных скачков.
- [ ] J08. Проверить emotion smoothing, interrupt severity, critical interrupts и прекращение устаревшей анимации.
- [ ] J09. Проверить lip-sync на реальном audio clock; измерить p50/p95 и целевой drift ≤80 ms.
- [ ] J10. Проверить canvas resize/render loop, expression cache, stale callback и iframe lifecycle.
- [ ] J11. Проверить browser hidden/background throttling и восстановление после переключения вкладки.
- [ ] J12. Завершить voice provider selection, API/config diagnostics и отсутствие credentials в UI/source.
- [ ] J13. Проверить RU/EN pronunciation, timings, pauses, emotion registers и fallback voice.
- [ ] J14. Проверить TTS cancellation по точному speechEventId; старый audio не должен продолжаться после interrupt.
- [ ] J15. Провести Android/Termux тест на физическом устройстве с записью audio route, interruptions, latency и actual silence.
- [ ] J16. Проверить STT permissions, timeout, noise/error recovery и privacy.
- [ ] J17. Проверить CPU/GPU/RAM, thermal load и утечки в многочасовой avatar+voice сессии.
- [ ] J18. Автоматизировать browser/Live2D runtime E2E в CI и обеспечить evidence report.
- [ ] J19. Проверить offline/no-model/no-audio fallback и читабельную диагностику.
- [ ] J20. Критерий: настоящее тело синхронизировано с внутренним состоянием и речью в browser/mobile runtime; unit timeline tests остаются только одним уровнем проверки.

## Этап K — app/runtime, dependencies, local models и install
- [ ] K01. Сверить Node/npm/Python versions, engines, lockfiles, optional deps и cross-platform assumptions.
- [ ] K02. Провести чистую установку без кэша/предустановленных артефактов; зафиксировать команды и среду.
- [ ] K03. Проверить весь dependency graph, циклические/лишние зависимости и несовместимые версии.
- [ ] K04. Убедиться, что приложение не требует неописанных глобальных tools или ручного копирования файлов.
- [ ] K05. Проверить app/runtime typecheck, scripts, lint/release verifier и production bundle.
- [ ] K06. Выполнить production build вместе с миграциями БД, restore и rollback из настоящего snapshot.
- [ ] K07. Проверить DB migrations на пустой базе, последней поддерживаемой схеме и частично выполненной migration.
- [ ] K08. Довести Docker Compose: health checks, volumes, network, graceful shutdown, env validation и restart policy.
- [ ] K09. Проверить service supervisor, bounded startup time и диагностические ошибки недостающей конфигурации.
- [ ] K10. Проверить локальную модельный backend selection, provider fallback, circuit breaker и cancellation.
- [ ] K11. Выполнить реальный llama.cpp/local model smoke на целевом ПК, включая качество и latency, а не только skipped test.
- [ ] K12. Проверить модель на телефоне/Termux отдельно; не предполагать переносимость ПК benchmark на мобильный CPU/RAM.
- [ ] K13. Обеспечить ограничение памяти/CPU и деградацию необязательной функциональности вместо падения ядра.
- [ ] K14. Проверить secrets/env files, API key handling, logs redaction и безопасные default values.
- [ ] K15. Обеспечить Doctor/diagnostic command с actionable выводом и exit code.
- [ ] K16. Проверить чистую установку/обновление/откат версии с пользовательскими данными.
- [ ] K17. Проверить Windows/Linux/Android paths, case sensitivity, symlinks и filesystem identity, где поддерживается.
- [ ] K18. Измерить startup, CPU/RAM, disk growth, retrieval latency и длительную деградацию.
- [ ] K19. Документировать минимальные и рекомендуемые конфигурации.
- [ ] K20. Критерий: одна документированная команда запуска поднимает полный поддерживаемый stack на clean machine, а диагностика указывает реальную причину неисправности.

## Этап L — CI, tests, release gates and test evidence
- [ ] L01. Восстановить actionable GitHub Actions step/job logs для всех обязательных workflow.
- [ ] L02. Проверить triggers/path filters, чтобы изменения тестируемого кода не пропускали owning workflow.
- [ ] L03. Прогнать focused regressions, unit/contracts, runtime wiring, app scripts и TypeScript на exact candidate SHA.
- [ ] L04. Запустить unified cognitive integration suite на текущем exact HEAD.
- [ ] L05. Запустить final release verification на точном кандидате с правильным строгим режимом.
- [ ] L06. Отличать flaky/runner infrastructure failure от code failure; повторять только с описанием основания и новой ссылкой run.
- [ ] L07. Не принимать исторический pass за проверку новых изменений.
- [ ] L08. Каждый workflow report должен показывать SHA, runtime versions, commands, summary и artifact links.
- [ ] L09. Добавить tests inventory reachability audit и просматривать unreferenced candidates до удаления.
- [ ] L10. Проверить, что тестовые mocks не обозначаются как real provider/device coverage.
- [ ] L11. Установить severity policy: P0 blockers запрещают release; P1 допускаются только с обоснованием и owner.
- [ ] L12. Включить security/license/dependency scans и проверку секретов в релизные ворота.
- [ ] L13. Добавить build artifacts checksums и reproducibility check.
- [ ] L14. Протестировать fail-closed release verifier: invalid/missing metadata, unknown CLI args, tracked bytecode/cache, stale workpass metadata.
- [ ] L15. Убедиться, что CI-исключения ограничены конкретной областью и не обходят strict operator gate.
- [ ] L16. Критерий: один immutable candidate SHA имеет успешный комплект required workflows; каждый незакрытый failure объяснён и разрешён.

## Этап M — независимая оценка и field validation
- [ ] M01. Зафиксировать baseline model/runtime, datasets, configs, prompt/model versions и hardware.
- [ ] M02. Создать независимые RU/EN task families, включая memory-grounded action и незнакомые контексты.
- [ ] M03. Сделать holdout immutable до фиксации кандидата; документировать leakage checks.
- [ ] M04. Запустить ≥5 paired seeds и хранить каждый case, не только агрегат.
- [ ] M05. Рассчитать статистическую неопределённость и доверительные интервалы; не делать вывод по единственному seed.
- [ ] M06. Измерить task success, tool-use correctness, retrieval, calibration, regret, retention, transfer и error recovery.
- [ ] M07. Измерить вредные действия, false confidence, unsupported claims, policy violations и safe-abstention.
- [ ] M08. Проверить resource cost: tokens, CPU/GPU, RAM, storage, latency и energía на task.
- [ ] M09. Сравнить на одинаковом budget и сопоставимых baseline/candidate условиях.
- [ ] M10. Провести независимую оценку внешними verifier/task checkers, а не тем же компонентом, который сгенерировал кандидата.
- [ ] M11. Публиковать score delta только при достаточном количестве независимых задач и отсутствии критического регресса.
- [ ] M12. Проверить тесты на новом реальном опыте, не подменяя его синтетическими фикстурами.
- [ ] M13. Повторить benchmark после интеграции Hexis и после изменений retrieval/learning.
- [ ] M14. Критерий: есть воспроизводимое поле доказательств, которое подтверждает полезность и ограничения системы.

## Этап N — long-run, recovery, privacy и security
- [ ] N01. Провести минимум 24-часовой soak, предпочтительно 72 часа, на целевом окружении.
- [ ] N02. Собирать latency p50/p95/p99, CPU, RAM, disk, errors, restart count и thermal/resource traces.
- [ ] N03. Проводить randomized process-kill в разных точках сохранения/действия.
- [ ] N04. Проверять восстановление при corrupt/truncated snapshots и старых schema versions.
- [ ] N05. Проверить disk-full, lock contention, permission errors и атомарность файловых записей.
- [ ] N06. Проверить queue overflow/backpressure и корректное восстановление после потери provider.
- [ ] N07. Проверить action acceptance/ACK gap и exactly-once approximation на внешнем провайдере через idempotency+reconciliation.
- [ ] N08. Проверить безопасную отмену/остановку и отсутствие оставшихся процессов/звука/внешних побочных действий.
- [ ] N09. Проверить user data export/deletion и отсутствие восстановления удалённых данных.
- [ ] N10. Провести prompt-injection, tool output poisoning, forged receipt, signed artifact replay и trust-boundary tests.
- [ ] N11. Проверить executor/verifier/scanner separation на реальном OS/container boundary; разные function/object identity не заменяют административную изоляцию.
- [ ] N12. Выполнить secrets scan, dependency vulnerability check, SBOM and third-party license inventory.
- [ ] N13. Зафиксировать threat model, known limitations, data paths и retention policies.
- [ ] N14. Проверить аварийный rollback на предыдущий release без потери пользовательской памяти.
- [ ] N15. Критерий: система переживает реальные отказы и длительную работу без потери состояния, опасного повторения действий или невидимого накопления ошибок.

## Этап O — release archive, docs and final acceptance
- [ ] O01. Заморозить candidate source SHA после закрытия кода/CI.
- [ ] O02. Сверить список включаемых файлов и исключений с canonical manifest.
- [ ] O03. Пересобрать полный ZIP из актуального исходного дерева; не переименовывать старый archive как новый.
- [ ] O04. Вычислить SHA-256 и сохранить manifest/size/build provenance.
- [ ] O05. Проверить отсутствие секретов, локальных данных, временных caches и неучтённых артефактов в архиве.
- [ ] O06. Проверить, что новый ZIP соответствует точно указанному source commit и проверенным dependencies.
- [ ] O07. Установить ZIP на clean machine, запустить startup smoke, server/app, memory write/read, action receipt и restore.
- [ ] O08. Выполнить browser/Live2D/voice E2E и целевой Android smoke до публикации.
- [ ] O09. Применить DB migration, проверить restore, затем проверить rollback.
- [ ] O10. Обновить Release description, checksums, change log, quick start и known limitations.
- [ ] O11. Согласовать README, release tag, source SHA, manifest и archive SHA без расхождений.
- [ ] O12. Публиковать только после явно разрешённых release gates; не заявлять production-ready при любом открытом P0.
- [ ] O13. Сохранить отчёт acceptance, ссылки на workflow, device logs и точные известные ограничения.
- [ ] O14. Создать rollback procedure и проверить её на практике.
- [ ] O15. Критерий: любой пользователь может воспроизвести установку по документации, а опубликованный архив точно соответствует доказанно проверенному кандидату.

## Этап P — финальная поведенческая приёмка организма
- [ ] P01. Сценарий: пользовательская информация сохраняется как provenance-bound memory и извлекается в последующем разговоре.
- [ ] P02. Сценарий: новый факт противоречит старому; система сохраняет историю, уверенность и основание пересмотра.
- [ ] P03. Сценарий: без внешнего сообщения внутреннее состояние запускает инициативу и объясняет причину.
- [ ] P04. Сценарий: модель мира прогнозирует последствие, действие исполняется через gateway и postcondition проверяется независимо.
- [ ] P05. Сценарий: неверный action receipt или forged event не меняет памяти/обучения.
- [ ] P06. Сценарий: кандидат навыка не проходит holdout и не может активироваться.
- [ ] P07. Сценарий: подтверждённый кандидат активируется по explicit approval, переживает restart и может быть откатан.
- [ ] P08. Сценарий: EthicGate запрещает выход за полномочия и блок корректно отражён в UI/voice.
- [ ] P09. Сценарий: emotion/relationship state влияет на голос и выражение аватара без рассинхронизации с основным состоянием.
- [ ] P10. Сценарий: переключение двух вариантов аватара не сбрасывает личность, память или цикл.
- [ ] P11. Сценарий: provider падает в середине действия; после рестарта система сверяет состояние и не выдумывает успех.
- [ ] P12. Сценарий: длительная тишина/простой приводит к полезной ограниченной инициативе, а не бесконечному циклу.
- [ ] P13. Сценарий: неизвестный вопрос вызывает корректную неопределённость/дополнительную проверку вместо выдуманного факта.
- [ ] P14. Сценарий: удаление пользовательских данных отражается в retrieval, snapshots, cache и дальнейших ответах.
- [ ] P15. Критерий: все сценарии работают на конечной собранной версии, с receipt/log/benchmark доказательствами, а не только unit mocks.


## Дополнение после проверки фактического runtime wiring (2026-10-26)
Проверка исходников обнаружила, что `HexisEvidenceMemoryBridge.ts` экспортирует ingress/review API и тестируется отдельно, но в активном `runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts` на проверенном HEAD нет его импорта/вызова и нет импорта `MemoryOS2`. Поэтому модульная интеграция пока не доказывает интеграцию с работающим организмом.

- [ ] E21. Определить реальный активный владелец памяти в `OrganismRuntime/OrganismCore` и доказать, как он соотносится с `MemoryOS2`; не объявлять MemoryOS2 каноническим для runtime без реального call path.
- [ ] E22. Выбрать единственный правильный runtime ingress для внешнего/Hexis evidence; подключить адаптер через существующие event/permission boundaries, а не прямой UI/HTTP обход.
- [ ] E23. Передавать canonical memory ID, source, digest, stance, observation time, independence key и review IDs из runtime-контекста, исключив caller-controlled provenance.
- [ ] E24. Подключить реальное сохранение/восстановление памяти, Hexis review, approvals и audit state к жизненному циклу production runtime.
- [ ] E25. Добавить end-to-end тест, который запускает runtime, импортирует evidence, подтверждает pending review, перезапускает процесс, восстанавливает review и принимает решение без повторной записи evidence.
- [ ] E26. Сделать аварийный тест с SIGKILL между canonical evidence append и review creation; in-process try/catch rollback не считается crash atomicity. Нужен durable transaction/outbox либо согласованный recovery/reconciliation protocol.
- [ ] E27. Проверить поведение при повторном событии после сбоя: pending review обнаруживается/восстанавливается, а не теряется за статусом duplicate.
- [ ] E28. Проверить реальную runtime memory API совместимость и миграцию существующих пользователей до подключения нового store; запрещено незаметно вводить второй writable memory owner.
- [ ] E29. Обновить architecture graph и runtime integration suite так, чтобы он падал, если Hexis API существует, но не подключён к активному runtime path.
- [ ] E30. Критерий: Hexis evidence-to-review подтверждён в живом runtime после restart/process-kill, и его state ownership однозначен.
- [ ] E31. При принятии review заново канонизировать payload через `adaptHexisEvidence`, пересчитать digest и сверить stance/source/timestamp/confidence/note с canonical receipt; при любом расхождении отказать без изменения memory или review state.
- [ ] E32. Добавить tampering-регрессии, где review snapshot меняет source ref/label/note/time/stance при сохранении старого digest; проверять отказ, неизменность canonical confidence и возможность безопасного повтора после восстановления доверенного snapshot.
- [ ] E33. Провести аудит всех legacy/public методов, которые напрямую вызывают `reviseBelief`, `updateSignals` или эквивалентную запись confidence; переводить их на canonical evidence→pending-review→explicit decision, а direct-mutation пути закрывать regression contract тестом.
- [ ] E34. Зафиксировать idempotency policy для evidence ID: identity зависит от canonical memory + source kind/reference + content fingerprint; stance/label/note/confidence входят в payload digest и их изменение при replay должно давать conflict, а не новый независимый vote.

## Definition of Done — жёсткие финальные ворота
1. Один канонический source SHA и чистая install.
2. Production build и миграции/restore/rollback пройдены.
3. Unified cognitive runtime проходит целевой цикл, interruption и process restart.
4. Память даёт независимый измеримый uplift, корректное забывание и отсутствие неприемлемого unsupported retrieval.
5. Обучение показывает проверяемый transfer/retention gain; кандидаты не активируются без независимого evidence gate.
6. Hexis evidence сохраняется в единственной канонической памяти, не меняя доверие и убеждения самовольно.
7. SelfModel/UserModel/motivation/EthicalGate реально участвуют в живом runtime.
8. Реальные browser/Live2D/voice и Android/Termux E2E пройдены.
9. Независимый verifier/scanner и реальная OS/container sandbox проверены.
10. 24–72 h soak, recovery, privacy, license/SBOM/security review закрыты.
11. Новый Release ZIP воспроизводимо собран, имеет manifest/SHA-256 и установлен на чистой машине.
12. README, CHANGELOG, tracker, release metadata и тестовая доказательная база совпадают.

## Ближайшая последовательность исполнения
1. Проверить exact-head WorkPass375/376 Hexis adapter+MemoryOS2 bridge, устранить обнаруженные ingress edge cases, запустить targeted tests/typecheck/integration.
2. Разрулить открытые стековые PR по зависимостям и зафиксировать единственный integration head.
3. Закрыть runtime ingress / snapshot / receipt / operational-cycle atomicity.
4. Выполнить независимый retrieval/learning benchmark; не менять оценку без uplift.
5. Выполнить production build, migrations, browser/voice/Android E2E и soak.
6. Пересобрать Release ZIP, проверить чистую установку и опубликовать только после финальных ворот.
