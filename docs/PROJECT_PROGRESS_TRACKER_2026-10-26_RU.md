## WorkPass421 — отклонять некорректный HMX source_attribution вместо молчаливого удаления (2026-10-26)

- **Код адаптера:** `77c57d9283f2805711a1c5e3db11c38af8b826f2`; **регрессия:** `d7be9e5da89bb8523e42d422533112e9a0304461`.
- Schema теперь требует, чтобы `source_attribution` был объектом, если поле присутствует. Normalizer возвращает `null` для scalar/array вместо превращения записи в якобы не имеющую источника.
- Это дополняет проверку числового диапазона `source_authority_01`: malformed attribution создаёт schema conflict, поэтому полная секция memories не может попасть в canonical merge.
- Регрессия проверяет отсутствие исключения, path-specific schema issue и null projection для строкового `source_attribution`.
- **Валидация:** PENDING exact-head HMX adaptation, runtime typecheck, server smoke и Unified integration. PASS не заявляется; оценки не повышены, `main` и canonical Release ZIP не изменялись.

---

## WorkPass420 — валидация HMX поверх уже созданного bounded snapshot (2026-10-26)

- **Рефакторинг адаптера:** `86ec7974749de51ef1a78375e0da45d4772c34c7`; **связка fabric:** `619535a9cf23e3463ca4a8b1809a07811e512f00`; **регрессия:** `b801a6eb2b67a6270f4f2a4dc745a3bf32433100`.
- Добавлена `snapshotAndValidateHmxV17Document`: она единожды захватывает недоверенный input, валидирует отделённое plain-JSON дерево и возвращает snapshot вместе с issues. Публичная `validateHmxV17Document` по-прежнему безопасно захватывает произвольный raw input, а `stageHmx` использует combined result без второго полного deep copy/serialization прохода.
- Restore-time validation по-прежнему вызывает публичную safe API, потому что проверяет сохранённое состояние. Первичный staging уже имеет отделённый snapshot, поэтому его дополнительное копирование не нужно; прочие callers не менялись.
- Регрессия проверяет отделённый объект результата, отсутствие schema issues у валидного документа и отказ от accessor-backed input без выполнения getter. В focused suite сохранены изоляция stage snapshot и fail-closed проверки malformed metadata.
- **Валидация:** PENDING exact-head HMX adaptation, runtime typecheck, server smoke и Unified integration. PASS не заявляется; оценки не повышены, `main` и canonical Release ZIP не изменялись.

---

## WorkPass419 — строгая проверка типов HMX metadata до coercion (2026-10-26)

- **Код адаптера:** `718478b8fb815909c4b2c31098921b2a0cac23bf`, `3bc3bee2f68a0c3f99920e1cc1d898cc9797afa3`, `c39fd277fc2e5c79495a92df1d215171502539c0`; **регрессии:** `f6f3ee592273430e787dc2d60f865d0abca0128b`, `693567b8100b83ab0d8ff1ffad8c31fcf3bca8cb`, `f6ff13bb81276752e1500181ea83f9f75f57a657`, `19afcc0376e55b26511713776a09438bcc4a7e79`.
- Проверки `export_intent`, privacy policy values и memory `nk1_kind` заменены на явную проверку типов. Metadata перед импортом проверяет confidence/salience/trust числа, массивы `tags`/`entities` и форму context.
- `normalizeHmxV17Memory` теперь возвращает `null` для неверных типов вместо coercion null-prototype objects в строки/числа; numeric clamp также стал exception-safe. HMX refs ограничены 512 символами, а source-authority валидируется при наличии.
- Регрессии покрывают null-prototype объекты в export intent, privacy, metadata kind/confidence/tags, type и source-authority; требуется schema issue либо null projection вместо исключения. Ссылка памяти длиной выше лимита отклоняется.
- Дополнительный stage-level тест требует, чтобы некорректная metadata создавала visible conflict, приводила к атомарному исключению всей секции memories и оставляла стадию недоступной для canonical apply.
- **Валидация:** PENDING exact-head HMX adaptation, server smoke, runtime typecheck и Unified integration. PASS не заявляется; оценки не повышены, `main` и canonical Release ZIP не изменялись.

---

## WorkPass418 — исключить дублирующее глубокое копирование после bounded HMX snapshot (2026-10-26)

- **Код fabric:** `8325edfe46cc263b79a146dee94268e14c07c6d0`; **регрессия изоляции:** `849453058df8ca197e623432b66d6d17bad0e945`.
- `stageHmx` использует ссылки на секции внутри уже изолированного bounded plain-JSON snapshot вместо повторного deep clone каждого массива/объекта. Метод по-прежнему возвращает `structuredClone` всей стадии, поэтому caller не получает доступ к сохранённому внутреннему состоянию.
- Это снижает дублирующие аллокации на больших HMX-файлах, сохраняя проверку accessors/prototypes/resource bounds и атомарное исключение conflicted-секций.
- Регрессия независимо меняет исходный HMX документ и возвращённый объект стадии и проверяет, что сохранённое содержимое не меняется ни в одном случае.
- **Валидация:** PENDING exact-head HMX adaptation test, runtime typecheck, server smoke и Unified integration. PASS не заявляется, оценки не повышены; `main` и canonical Release ZIP не изменялись.

---

## WorkPass417 — снимок HMX request envelope без выполнения getters (2026-10-26)

- **Код fabric:** `ff87945607101053a2ec4dad99eb41772d989a56`; **регрессия:** `cc2bf0633fbc61f1da5862c0df214f688cf9ac07`.
- `stageHmx` теперь извлекает `document`, `intent` и `strategy` через собственные data descriptors из plain request envelope. Accessors, унаследованные/custom-prototype envelopes и дополнительные поля отвергаются с `hmx-unsafe-stage-request` до чтения значений, валидации документа, создания стадии или изменения метрик.
- Само поле `document` по-прежнему проходит через существующий bounded HMX snapshot; поэтому текущая диагностика некорректного HMX payload сохраняется. Запросные getters больше не могут менять metadata между allowlist validation и staging.
- Регрессии требуют, чтобы getters для intent/document не исполнялись, запросы были отвергнуты и stage ledger оставался пустым. Runtime allowlist intent/strategy сохраняется после capture.
- **Валидация:** PENDING exact-head `test:hexis-adaptation`, runtime typecheck, server smoke и Unified integration. PASS не заявляется; оценки не повышены, `main` и canonical Release ZIP не изменялись.

---

## WorkPass416 — allowlist intent/strategy внутри HexisAdaptationFabric (2026-10-26)

- **Код fabric:** `d82d5f9c77a303322b6a379e9b664111917f9bf0`; **direct-call регрессия:** `b1595b492f0424b754e50e600aadebd2d379f7ae`.
- Те же allowlists добавлены в `HexisAdaptationFabric.stageHmx`, а не только в HTTP route. Прямые/internal callers получают `hmx-invalid-intent` или `hmx-invalid-strategy` до snapshot входного документа, создания стадии или изменения метрик.
- Регрессия вызывает fabric напрямую с неизвестными intent/strategy и требует исключения с пустым stage ledger. Вместе с WorkPass415 HTTP-smoke контракт теперь проверяется на обоих входных слоях.
- **Валидация:** PENDING exact-head HMX adaptation, server smoke, runtime typecheck и Unified integration. PASS не заявляется; оценки не повышены, `main` и canonical Release ZIP не менялись.

---

## WorkPass415 — проверка intent/strategy HMX на HTTP-границе (2026-10-26)

- **Код сервера:** `9f9601df7a72d9d0f6c46e24030052c554087237`; **server-smoke:** `bd2f036238b7b3582c6e9a17ee49991a66e0df54`.
- HMX staging route теперь принимает только разрешённые значения intent (`port`, `duplicate`, `telepathy`, `analysis`) и strategy (`additive`, `authoritative`, `deliberative`, `analysis_only`). Отсутствующие поля сохраняют явные preview-only defaults; переданные неверные типы/значения получают HTTP 400 до вызова fabric.
- Регрессия отправляет ошибочный intent и недопустимую strategy, проверяет `hmx-invalid-intent`/`hmx-invalid-strategy`, затем продолжает с валидным telepathy/additive stage.
- **Валидация:** PENDING exact-head `test:hexis-server-smoke`, runtime typecheck, HMX adaptation и Unified integration. PASS не заявляется, оценки не повышены; `main` и canonical Release ZIP не изменялись.

---

## WorkPass414 — блокировка повторного accept до сохранения HMX-квитанции (2026-10-26)

- **Код адаптера:** `0fc2a3880ef1276106e78dbcd4ab15ce53feb1d2`; **регрессия:** `daa458f2abd935f136b249d1cb3ae6b9ccccf0c5`.
- Расширен guard WorkPass413: любое повторное решение уже принятой memory-merge стадии с квитанцией `pending` теперь закрывает её как `uncertain` до возврата в core — как при повторном `accept`, так и при позднем `reject`.
- Первое явное принятие не затронуто: оно входит в `decideHmx` из состояния `staged`. Повторные accept/reject получают разные reason-коды и больше не возвращают комбинацию `accepted + pending` к state-based guard канонического импорта.
- Регрессия покрывает повторный accept, terminal reason и дальнейшие accept, оставшиеся без replay; тест позднего reject также сохранён.
- **Валидация:** PENDING exact-head `test:hexis-adaptation`, runtime typecheck, server smoke и Unified integration. PASS не заявляется, оценки не повышены; `main` и canonical Release ZIP не изменялись.

---

## WorkPass413 — поздний reject не должен повторно запускать HMX-импорт (2026-10-26)

- **Код адаптера:** `443d5d83635645e967c7da245f2a75a8af284e03`; **регрессия:** `a4fba62670b3e6a5215b9083853a530b41c5fc79`.
- Обнаружена ошибка порядка решений: core запускает импорт по комбинации `accepted + pending`. Если повторный запрос `reject` приходил уже после принятия, стадия оставалась в том же состоянии и могла снова попасть под импортный guard.
- `HexisAdaptationFabric.decideHmx` теперь переводит такой поздний reject в терминальный `uncertain` с причиной `reject-request-after-accept-before-import-receipt`. Факт уже записанного операторского принятия сохраняется — отклонение не может безопасно отменить неизвестные побочные эффекты, — но core больше не получает apply-eligible стадию для replay.
- Регрессия проверяет accept → поздний reject → terminal receipt → повторный accept без запуска нового импорта.
- **Валидация:** PENDING exact-head `test:hexis-adaptation`, runtime typecheck, server smoke и Unified integration. PASS не заявляется, оценки не повышены; `main` и canonical Release ZIP не изменялись.

---

## WorkPass412 — проверить HMX recovery после реального JSON round-trip (2026-10-26)

- **Регрессия:** `dccd678206df42ac6ed7c1f057e741619c0d453e`.
- Усилены тесты WorkPass408: перед восстановлением вся Hexis adaptation snapshot сериализуется через `JSON.stringify/JSON.parse`. Обычный прерванный accept и восстановление изменённого payload теперь проходят через ту же JSON-границу, что использует сохранённое состояние runtime, а не только через копию в памяти.
- Остаются обязательными проверки терминального `uncertain`, сохранения решения оператора, точного учёта исходных записей, защиты от повторного accept и сохранения конфликта integrity.
- **Валидация:** PENDING exact-head `test:hexis-adaptation`, runtime typecheck, server smoke и Unified integration. PASS не заявляется, оценки не повышены; `main` и canonical Release ZIP не изменялись.

---

## WorkPass411 — не приписывать каждому uncertain HMX откату (2026-10-26)

- **Текст UI:** `1f45d8ec3cc7eb16efa8e75da262197c4ff73cb9`; **wiring-audit:** `545b8e01a234e9e959b1d6e8ab33462ad5e27617`.
- Исправлено неточное предупреждение: `uncertain` может обозначать как неполный rollback, так и остановку процесса до сохранения квитанции. Интерфейс теперь говорит, что исход импорта не подтверждён, а не утверждает, будто откат точно провалился.
- Все счётчики помечены как непроверенные служебные значения, не доказывающие, какие строки применились. Пользователю предлагается проверить каноническую память и сохранённую квитанцию до дальнейших действий.
- UI wiring audit требует нейтральную к причине формулировку и явный запрет на повторный импорт.
- **Валидация:** PENDING frontend build и UI wiring audit; exact-head PASS не подтверждён, оценки не повышены. `main` и canonical Release ZIP не изменялись.

---

## WorkPass410 — явно пометить счётчики uncertain HMX как непроверенные (2026-10-26)

- **Текст UI:** `306b075e22f610b60783d489015f8a8519d77212`; **wiring-audit:** `85c700822e22ce7d6c9140986296fd924417f511`.
- Сообщение `UNCERTAIN` больше не представляет счётчики как подтверждённые создания/повторное использование. Оно прямо сообщает, что значения лишь возвращены прерванной операцией и не проверены, и требует сверить каноническую память и квитанцию до дальнейших действий.
- Wiring-audit требует эту формулировку вместе с предупреждением не повторять импорт.
- **Валидация:** PENDING frontend build и UI wiring audit; exact-head PASS не подтверждён, оценки не повышены. `main` и canonical Release ZIP не изменялись.

---

## WorkPass409 — сохранить результат операции при ошибке обновления панели (2026-10-26)

- **UI-код:** `895b4c338a0a40e3441af5ee51a5c8a63bcc46f2`; **wiring-audit:** `cee8f2841d34bddda5b1780844c5908133bececa`.
- Общий обработчик консоли больше не считает успешно завершённое действие неудачным, если после него упал отдельный запрос обновления состояния/списка памяти. Результат исходной операции возвращается вызывающему обработчику, а ошибка refresh отображается отдельно.
- Это не позволяет потерять HMX import receipt до того, как специализированный обработчик покажет `APPLIED`, `PARTIAL`, `SKIPPED` или `UNCERTAIN`.
- `audit-ui-function-wiring.mjs` теперь проверяет, что результат операции сохраняется при отдельной ошибке refresh.
- **Валидация:** PENDING frontend build и UI wiring audit; HMX adaptation/server smoke, runtime typecheck и Unified integration не подтверждены на пригодном exact-head CI. PASS не заявляется; оценки не повышены, `main` и canonical Release ZIP не изменялись.

---

## WorkPass408 — карантин HMX-импорта, прерванного до сохранения квитанции (2026-10-26)

- **Код:** `f12ad52ed62a852df476c88150a16abab8e56288`; **регрессия:** `7456ba64763ec253cb86ec33619a23c0e3210a15`.
- Найдено окно replay при перезапуске: процесс мог остановиться после перехода HMX-стадии в `accepted`, но до записи итоговой квитанции канонической памяти. Restore оставлял `accepted + pending`, позволяя повторному accept повторно запустить импорт.
- Restore теперь переводит принятые memory-merge стадии с pending-квитанцией в терминальный `uncertain`. Решение оператора сохраняется; исходные строки учитываются без заявления о фактическом успешном/неуспешном применении. При несоответствии сохранённого digest дополнительно сохраняется конфликт `persisted-stage-integrity-failure`.
- Регрессии покрывают обычное прерывание принятого импорта, повторный accept после восстановления, учёт исходных строк и tampering payload до restore.
- **Валидация:** PENDING exact-head `test:hexis-adaptation`, server smoke, runtime typecheck и Unified integration. PASS не заявляется; оценки не повышены, `main` и canonical Release ZIP не изменялись.

---

## WorkPass407 — полная матрица неверных JSON body для Hexis POST (2026-10-26)

- **Server-smoke regression:** `1e0bdf8ad632c0bf37a356aba08c7d28b7712eb3`.
- Расширен smoke для всех 17 POST-маршрутов Hexis: каждый получает JSON `null`, массив, строку, число и boolean.
- Каждый некорректный тип обязан возвращать HTTP 400 `hexis-invalid-request-body`; сообщение ошибки включает маршрут и конкретное значение. Проверка теперь не опирается только на один вариант `null`.
- **Валидация:** PENDING exact-head `test:hexis-server-smoke`, runtime typecheck и Unified integration. PASS не заявляется, оценки не повышены; `main` и canonical Release ZIP не менялись.

---

## WorkPass406 — UI явно показывает итог HMX import receipt (2026-10-26)

- **UI-код:** `a330d9bd1ca2602e3cfcc0fe75d513a8f67e7875`; **audit regression:** `ddcc11684dcc7cb51c2d1cabae3a9c8ff999b122`.
- Кнопка принятия HMX теперь анализирует квитанцию и выводит отдельный итог `APPLIED`, `PARTIAL`, `SKIPPED`, `PENDING` или `UNCERTAIN`, включая счётчики/причину при наличии.
- Неопределённый или оставшийся pending результат больше не маскируется под обычное `Accept HMX: OK`. После терминальной квитанции локальные controls сбрасываются; при неизвестном результате интерфейс предупреждает не повторять эту стадию и проверить каноническую память/квитанцию.
- `audit-ui-function-wiring.mjs` теперь проверяет, что warning для uncertain/pending существует и связан с кнопкой принятия.
- **Валидация:** PENDING frontend build, UI wiring audit, exact-head runtime typecheck, HMX adaptation/server smoke и Unified integration. PASS не заявляется; оценки не повышены, `main` и canonical Release ZIP не изменялись.

---

## WorkPass405 — неопределённый результат HMX при неполном rollback (2026-10-26)

- **Код:** `7c50f4a34dfc1198b9ec1347b1938d38fd7e73cc`; **регрессия:** `637429b82ae8913760b89b9544cd21a00457c3bd`.
- Обнаружен тупик квитанции после WorkPass403: при `rollback-incomplete` core мог передать статус `partial` с несогласованными счётчиками. Уже принятая стадия тогда оставалась `pending`, что позволяло повторный запуск импорта с потенциально сохранившимися побочными эффектами.
- Добавлен терминальный статус `uncertain` для результата `memory-encode-failed-rollback-incomplete`. Квитанция сохраняет только подтверждённые счётчики `created/reused`, пересчитывает остаток исходных строк и закрывает стадию без заявления об успешном применении. Повторная квитанция не может заменить её на `applied`.
- Регрессия проверяет точный учёт исходной записи, терминальность `uncertain` и защиту от replay.
- **Валидация:** PENDING exact-head typecheck, `test:hexis-adaptation`, server smoke и Unified integration. PASS не заявляется: требуются usable exact-head CI steps/logs. Прогресс и оценки не повышены; `main` и canonical Release ZIP не изменялись.

---

## WorkPass404 — единая проверка JSON body на всей Hexis API-границе (2026-10-26)

- **Код сервера:** `9e67b36842b28042de4b82ad049452e5b01ad747`; **smoke regression:** `0e72a6d377e3e19f7181372de0b9c0a9b8e0af2a`.
- Общий guard применён ко всем 17 POST-маршрутам Hexis: peer consult, sync-memory, belief/review, retention, HMX, outbox, connector policies и execution-plan.
- JSON `null`, массивы и primitive values возвращают HTTP 400 `hexis-invalid-request-body` до чтения полей или изменения состояния.
- Smoke отправляет `null` по всем 17 маршрутам и требует идентичный отказ; дополнительные invalid-decision/action и HMX integrity regression сохранены.
- **Валидация:** PENDING exact-head runtime typecheck, HMX adaptation, server smoke и Unified integration. PASS не заявляется; Actions не предоставляют usable step/log evidence. Прогресс не повышен; `main` и canonical Release ZIP не изменялись.

---

## WorkPass403 — строгая проверка завершения HMX import receipt (2026-10-26)

- **Код:** `ed92b4abf74395cc3d6946eadd0482eca2f839d2`; **регрессия:** `8969a6401719d9105162e50d00a35c79f4e98b51`.
- `recordHmxImportResult` не нормализует некорректные значения через clamp/floor. Принимаются только известные статусы, неотрицательные safe-integer counts, bounded reason и точный учёт исходных memory records: `created + reused + skipped === sectionCounts.memories`.
- `applied` не может содержать skipped rows, `skipped` не может иметь created/reused, а `partial` должен действительно отражать частичное применение. Некорректный receipt оставляет статус `pending`.
- Тесты покрывают NaN, неучтённые записи и несовместимый partial-status; затем валидный receipt завершается, а повтор не переписывает counts.
- **Валидация:** PENDING exact-head typecheck, HMX adaptation, server smoke и Unified integration. PASS не заявляется; оценки не повышены, `main` и canonical Release ZIP не менялись.

---

## WorkPass402 — повторная проверка integrity pending HMX stage (2026-10-26)

- **Код:** `307b1317100bd9d4e3d62094f552a074fb1f663c` и `66927b5571704895f78f7c02897cd42e12fce8ea`; **регрессии:** `6f40c41ec9ff705561c1389fb8760956d41cfee1` и `388156d09c62dc736b5dcbe44a43fce303dedc0a`.
- При восстановлении и решении pending-stage повторно проверяется digest исходного staging-снимка и HMX схема. Изменённая после проверки стадия становится `rejected` с `persisted-stage-integrity-failure`; import receipt не считается применённым.
- Корректная стадия с исходными schema-конфликтами остаётся `staged` для просмотра/отклонения; явное принятие по-прежнему блокируется.
- Тест изменяет сохранённое содержимое pending evidence до восстановления и требует quarantine; отдельный тест сохраняет поведение ожидаемых validation-конфликтов.
- **Валидация:** PENDING exact-head typecheck, `test:hexis-adaptation`, server smoke и Unified integration. PASS не заявляется. Прогресс/готовность/recall не повышались; `main` и canonical Release ZIP не менялись.

---

## WorkPass401 — защита staging-словарей от `__proto__` (2026-10-26)

- **Код:** `47d88fcc1a8b5737cca6c542a51e3d0011f8281a`; **регрессия:** `76830a380ab2cdbd825994062de793c2a1a0c2f0`.
- `sectionCounts` и `stagedSections` теперь создаются без prototype. Враждебное имя секции `__proto__` остаётся обычным диагностическим ключом и не меняет прототип словаря.
- Тест проверяет отказ секции, сохранение исходного количества, отсутствие её в staged payload, prototype-free карты и запрет acceptance.
- **Валидация:** PENDING exact-head typecheck, HMX adaptation, server smoke и Unified integration. PASS не заявляется; пригодный exact-head CI-вывод пока недоступен. Оценки не повышены; `main` и canonical Release ZIP не менялись.

---

## WorkPass400 — guard Hexis endpoints от не-объектного JSON (2026-10-26)

- **Код сервера:** `416c8df040e778c431ac999242d0d339a0a5940f`; **smoke regression:** `6132b9112a398d37d1dc975fe08bff0b48a9d6f5`.
- Learning-review decision, retention propose, HMX stage и HMX decision теперь требуют JSON object. Литеральный `null`, массив или primitive возвращает HTTP 400 `hexis-invalid-request-body` до чтения route-specific полей и до mutation.
- Smoke отправляет `null` во все 4 endpoint и проверяет идентичный 400-контракт; тесты неверных decision/action сохранены.
- **Валидация:** PENDING exact-head typecheck, HMX adaptation, server smoke и Unified integration. PASS не заявляется; Actions не предоставляют пригодные логи. Оценки неизменны; `main` и canonical Release ZIP не менялись.

---

## WorkPass398 — неизвестные Hexis decisions отклоняются на HTTP-границе (2026-10-26)

- **Серверный код:** `7df90658a7633fcaee746a69197f9522818cc452`; **server-smoke regression:** `86edc9df9a802ce8aa6965c8091454eb779429d5`.
- Ранее неизвестное решение review неявно превращалось в `approve`, а неизвестное HMX-решение — в `reject`. Теперь обе API-границы требуют точного значения из allowlist и возвращают HTTP 400 до вызова mutation/flush.
- Smoke проверяет invalid decision для review и HMX; после неверного HMX-решения тот же валидный stage успешно отправляется на явный `accept` в рамках теста.
- **Валидация:** PENDING exact-head typecheck, `test:hexis-adaptation`, `test:hexis-server-smoke`, Unified integration. Actions пока падают до предоставления шагов/логов, поэтому PASS не заявляется. Оценки прогресса не менялись; `main` и canonical Release ZIP не изменялись.

---

## WorkPass397 — безопасный HMX snapshot на границе импорта (2026-10-26)

- **Кодовые коммиты:** `aead364e098b462b5f99f48e65b76585f927975f` (ограниченный plain-JSON snapshot) и `83343d9ba5765050c734218a64d8bbe6e9883f2f` (staging использует тот же snapshot); **регрессии:** `0f9c34c54ad2b858a142c5e14d0de28fb763f5b5` и `28920aa46a888ddff4a0297ae8a93526e879da85`.
- До schema inspection HMX копируется через own-data descriptors с ограничениями по глубине/узлам/байтам. Accessors, sparse/extended arrays, неподдерживаемые прототипы, циклы и non-finite numbers отклоняются без чтения свойств через getter.
- Validation и stage работают с захваченным снимком, а не с исходным объектом; это убирает расхождение «проверили одно, сохранили другое».
- Регрессии проверяют root/вложенный getter (0 вызовов), sparse array, цикл, non-finite number и нестандартный prototype. Во всех случаях появляется `unsafe-input`, memory payload не попадает в staging, принять stage нельзя.
- **Валидация:** PENDING exact-head typecheck, `test:hexis-adaptation`, server smoke и Unified integration. Тесты добавлены, но не подтверждены успешным запуском. Проценты/оценки не повышены; `main` и canonical Release ZIP не менялись.

---

## WorkPass396 — атомарный staging массивов HMX (2026-10-26)

- **Код:** `eb4b719d011bd035d05ae53f65599d15b5d7ae43`; **регрессии:** `c8fc71acd48348469dfa6d9cabd01ba9ea92fce6`.
- Массивы с более чем 256 записями и массивы с некорректным элементом целиком исключаются из `stagedSections`; исходный размер и причины конфликта сохраняются. Нельзя принять частичный префикс массива как будто это полный экспорт.
- Тесты требуют полного отказа для 257 записей и для ошибочной записи внутри корректного массива. Exact-head validation ожидает запуска.

---

## WorkPass357 — descriptor-only nested parent lineage restore (2026-10-26)

- **Code/test checkpoint:** `810f60f2227db466dd1f96b1e3edf39741951f9d`; stacked on WorkPass356 branch head `1d2a02d3091fd960f6d38880aa85e8d8bf9a1fee`.
- **Defect:** snapshot restore used `parentIds.length` directly. A proxy `get` trap could execute and provide a falsified length, which silently discarded lineage.
- **Fix:** bounded nested-array inspector validates prototype, length descriptor, dense indexed data descriptors and shape; parent validation only receives a regular array built from descriptors. Invalid rows are skipped before reserving IDs.
- **Regression:** a proxy attempts to report length zero and throws on direct slot reads; restore must not trigger either getter and must preserve the descriptor-backed parent. Another proxy throws during descriptor enumeration; restore catches it, skips the malformed row and recovers from a later valid duplicate.
- **Exact-head CI PASS:** PR head `a1f0e250eac1e0f6990a0c25e62d7c33bb8b1bd1` passed Unified project integration [#40292091015](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292091015), progress-ledger integrity [#40292091024](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292091024), WorkPass110 [#40292091053](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292091053), P26 [#40292091054](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292091054), and nine additional focused workflows. The Unified run passed cognitive integration, approval E2E, service/public gateway, runtime/research bridge smoke and final release gates without publishing an archive. The code/test checkpoint `810f60f2227db466dd1f96b1e3edf39741951f9d` is included in that tested head; only tracker/changelog commits followed. Historical CI evidence and scores remain unchanged.

---

## WorkPass356 — strict CEF tool receipt ingress (2026-10-26)

- **Code/test checkpoint:** `ae9a66a6f831b73d9c8457de4ea4454c376e3c1a`; based directly on latest target head `084c80745446c38bf514c43000844c433110f0c4`.
- **Defect:** receipt-trace/revision/external-observation APIs could execute caller getters and coerce or truncate IDs, booleans, counters, hashes and evidence text. Those transformations can cause malformed provider evidence to share an idempotency identity with accepted evidence.
- **Fix:** descriptor-only ingress; canonical IDs; strict string hashes, booleans, safe integer counters/ticks, finite timestamps and confidence in `[0,1]`; no truncation or Boolean/String coercion. Rejections occur before replay lookup and leave the journal and receipt projection index unchanged.
- **Regression:** `runtime/neuro-kurisu/tests/cognitive-tool-receipt-input-boundary.mjs` checks accessors/getters, hostile `toString()`, padded/overlong IDs, invalid boolean/confidence/revision counter, hashes/text type and unchanged ledger state. Exact valid revision replay remains idempotent. The test is wired into `test:cognitive-integration-suite`.
- **Base preservation:** newer bounded payload-clone and transactional snapshot restore in `084c80745446c38bf514c43000844c433110f0c4` are retained; this branch changes receipt ingress and test wiring only.
- **Exact-head CI PASS:** WorkPass356 PR head `1d2a02d3091fd960f6d38880aa85e8d8bf9a1fee` passed Unified integration [#40291855092](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291855092), progress-ledger integrity [#40291855384](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291855384), WorkPass110 [#40291855118](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291855118), P26 [#40291855059](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291855059), and nine additional focused workflows. The unified run passed all steps through final release gates without publishing an archive. Historical `ciSnapshot` rows and all readiness scores unchanged.

---

# NK1 — общая панель инженерного прогресса (2026-10-26)

**Источник:** `ailtron1ss-rgb/NK1`, combined source branch `fix/mega-cognitive-progress-tracking-2026-10-26-r3`. Точный проверенный code/test head: `621864d0d7f2676245383adab86f1dcc6d0f741f`, merged into the source branch as `39af7eb67c9ab05efd45d01cbd4b4d1d44751454`. На HEAD 621864d0d7f2676245383adab86f1dcc6d0f741f успешно прошли Unified project integration suite [#40257525157](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525157), WorkPass110 [#40257525071](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525071), WorkPass108 [#40257525093](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525093), P26 Learning Validation [#40257525095](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525095), progress-ledger integrity [#40257525008](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525008), plus outcome-ledger, replay, cognitive-contract, verified-experience, reflection and postcondition suites.

**Что реально проверено:** чистая установка app/runtime с Node.js 24; Python 3.12 + CPU PyTorch для research probes; doctor и installer lockfile contracts; UI build/typecheck; runtime typecheck; strict Unified Cognitive Substrate и 30-цикловое restore/restart; owner-approval E2E; NeuroCore/NOMEGA/DeepCode после явного одобрения; per-family distinct holdout-task gate; полный финальный smoke после устранения 8-секундного таймаута клиента.

**Новый WorkPass343:** исправляет future `lastTick` в derived cognitive-substrate sidecar, добавляет unit + restart-E2E регрессии и явные CI path-фильтры, но его новый code/test head `8b38a354e7a32ea8822e4cd44866c73f00ce0d1c` ожидает exact-head CI. Последний подтверждённый набор 13 workflows относится к `621864d0d7f2676245383adab86f1dcc6d0f741f`; проценты и CI evidence ниже к нему привязаны и не заявляются как доказательство WorkPass343.

**Оценки не повышены:** это подтверждает интеграцию и корректность защитных ворот, но не доказывает увеличение внешней успешности обучения или переноса навыков. Открыты реальные Android/Termux audio и датчики, browser/Live2D hardware E2E, длительный soak, license review и воспроизводимая замена большого GitHub Release ZIP.

**Машиночитаемый источник процентов:** [PROJECT_PROGRESS_TRACKER_2026-10-26_RU.json](PROJECT_PROGRESS_TRACKER_2026-10-26_RU.json).  
**Проверка таблицы:** `npm run test:progress-ledger`; **сводный отчёт:** `npm run progress:report`.

## WorkPass344 — final release gate (pending exact-head CI)

- `release:verify` requires UI wiring, architecture and metadata checks; JSON summary includes filesystem/tree failures.
- Default operator mode remains strict. After research smoke, CI mode allows only untracked `.pyc` files below `__pycache__`, reports warnings, and still rejects tracked bytecode, stray bytecode and non-bytecode files in cache directories.
- Eight regression cases cover metadata, CLI, strict/CI cache policies and attempts to bypass those policies.
- Current code/test checkpoint `064a7ac8f2cd91e692d7e7d3905a8a608a6a92b6` includes the final tracked-bytecode guard. New exact-head CI is pending; scores remain unchanged.

## WorkPass344 — fail-closed final release verification (pending current-head CI)

- `npm run release:verify` now requires UI wiring, architecture and metadata checks. The summary counts tree hygiene failures separately so a failed gate cannot report `failed: 0`.
- Six tests cover metadata pass/fail/missing-validator, unknown CLI args, strict Python cache rejection, and an explicit cache-tolerant CI mode.
- The integration workflow runs `release:verify:ci` only after research smoke. The normal operator `release:verify` remains strict and does not silently ignore bytecode.
- The first runs found and corrected two real pipeline issues: architecture scanner false-positive from an import assertion string and transient `__pycache__` from research smoke. Current code/test checkpoint `71176fa2275149a726a3aadeec827866d88a0cc0` needs new CI.
- WorkPass343 substrate tick reconciliation is preserved from the freshest source base. Scores remain unchanged; prior CI evidence is still anchored to `621864d0d7f2676245383adab86f1dcc6d0f741f`.

## Как читать проценты

Это начальная инженерная оценка по 12 направлениям, а не измерение «разума». Веса суммируются до 100%; скрипт считает четыре раздельных взвешенных показателя:

- **Реализация** — насколько много из нужного механизма уже реализовано и связано с runtime.
- **Автоматическая проверка** — насколько разработаны тестовые/контрактные проверки. Это не означает, что такой процент тестов прошёл на последнем commit.
- **Внешние доказательства** — насколько есть независимые результаты на реалистичных задачах; внутренние синтетические тесты сами по себе не повышают этот показатель.
- **Готовность релиза** — чистая установка, сборка, реальные провайдеры/устройства, UI/аватар/голос, продолжительный прогон, лицензии и воспроизводимый главный архив.

Сырые оценки и препятствия для каждого направления хранятся в JSON. Проценты — экспертный baseline для планирования; обновлять их можно лишь вместе с конкретными новыми source/CI/benchmark свидетельствами. Нельзя повышать реальную эффективность обучения только потому, что написан новый тест.

## Сводка текущего прогресса

| Измерение | Взвешенная оценка |
|---|---:|
| Реализация и интеграция механизмов | **66,6%** |
| Покрытие автоматическими проверками | **72,4%** |
| Независимые полевые доказательства | **17,4%** |
| Готовность к релизу | **34,9%** |

Это взвешенные инженерные оценки по 12 направлениям. Они не измеряют интеллект, сознание или автономность; процент автоматической проверки означает широту контрактов/регрессий, а не долю тестов, прошедших на текущем commit. Небольшой рост оценок implementation/validation связан с добавлением общего deadline в learning evaluator и успешной проверкой его интеграционных контрактов. Внешние данные об эффективности обучения и release readiness не увеличены.

## Что включено в панель

Взвешенно отслеживаются когнитивный цикл; модель мира и маршрутизация; память и непрерывность; внутренняя мотивация; планирование/действия/проверка последствий; continual learning/replay; создание и продвижение навыков; self/user model, ToM и этические ограничения; Live2D/avatar; голос и аудио; installer/build/CI; внешняя оценка, лицензии и главный релизный архив.

## Текущее доказательное состояние

- WorkPass331 добавил **подписанную per-family политику** для P23 promotion: явно заданные обязательные минимумы семейства входят в identity proposal; отсутствие evidence или gain ниже минимума блокирует gate. Это не означает, что любой skill обязан быть универсальным: целевые семейства задаются для каждого навыка.
- WorkPass332–333 добавили family labels и отдельные значения для SkillLearnBench-compatible validation/holdout отчётов; manifest family теперь проходит через fingerprint, run bindings и проверку перед записью в VerifiedOutcomeLedger. Высокий общий балл не должен скрывать провал tool-use или transfer. Для production продвижения остаётся отдельный подписанный P23 evidence gate.
- **WorkPass334 — ограничение полного evaluation budget:** независимая оценка кандидата использует единый монотонный deadline для всех задач validation + holdout, дополнительно к локальным timeout-ам sandbox/verifier/safety scanner. Истечение общего budget прекращает весь прогон; тест проверяет отмену зависающего executor и отсутствие запуска следующей задачи. Дефолт 5 минут; настройка `evaluationTimeoutMs` принимает 10–1800000 мс. Подробности: [WorkPass334 checkpoint](WORKPASS334_BOUNDED_INDEPENDENT_EVALUATION_RU.md).
- **WorkPass335 — preflight записи в VerifiedOutcomeLedger:** перед первой записью все bindings проходят runtime-проверку безопасных string run IDs, non-empty task/trial IDs, строгого `bindingVerified`, целого seed/safety count и допустимого split. Регрессия задаёт числовой `runId` во второй записи и проверяет, что ledger остаётся пустым. Подробнее: [WorkPass335 checkpoint](WORKPASS335_LEDGER_PREFLIGHT_ATOMICITY_RU.md).
- **WorkPass336 — evaluator-origin capability:** public SHA-256 можно пересчитать после изменения JSON, поэтому commit boundary теперь требует приватную in-process привязку точного объекта результата к исходному fingerprint. Подмена валидной строки `runId` с пересчитанным digest отклоняется до записи. Это не digital signature; cross-process/persisted evidence по-прежнему требует trusted signed-receipt verification. Подробнее: [WorkPass336 checkpoint](WORKPASS336_EVALUATOR_ORIGIN_ATTESTATION_RU.md).

- **WorkPass343 — reconcile sidecar clock with durable Core:** на старте `OrganismRuntime` сравнивает сохранённый `lastTick` проекции с каноническим Core tick. Если sidecar ушёл вперёд (включая `Number.MAX_SAFE_INTEGER`), переякоривается только clock, когнитивные метрики сохраняются. Добавлены unit-регрессия и реальный restart smoke: sidecar насильно получает future tick, затем после stop/re-init runtime подтверждает согласование и снова выполняет autonomous step. CI path-фильтры теперь явно включают wiring-тест и для PR, и для push. Code/test head `8b38a354…` пока без exact-head CI; статус `implemented / validation pending`, проценты не повышены. Подробности: [WorkPass343 checkpoint](WORKPASS343_SUBSTRATE_TICK_RECONCILIATION_RU.md).

- **WorkPass339 — строгая кодировка Ed25519 approval:** в combined diff также присутствует отказ от неоднозначных Base64-представлений подписи для promotion и rollback; отдельный набор подписей/тестов проходил на merge commit `4a41db0`. Эту проверку нельзя считать CI для combined HEAD; необходим новый совместный прогон. Подробности: [WorkPass339 checkpoint](WORKPASS339_STRICT_ED25519_APPROVAL_ENCODING_RU.md).
- **Validation status for combined WorkPass335/336/339–342:** exact combined code/test head `621864d0d7f2676245383adab86f1dcc6d0f741f` passed Unified integration, WorkPass110, WorkPass108, P26 and ledger integrity. The strict Ed25519 fix, the live cognitive substrate, task-family holdout gate and bounded research-probe deadlines all occur on that tested head. This closes their prior combined-head validation gap. Field-performance and hardware/release gates remain open.
- Исторический WorkPass329 proxy сравнение показывало family gain: memory=1, tool-use=0, transfer=0. Это известная слабость evidence, не заявка на обобщённый успех.
- **Актуальный подтверждённый CI snapshot:** на combined code/test head `621864d0d7f2676245383adab86f1dcc6d0f741f` успешно завершились 13 проверок, включая полный запуск runtime, `TYPECHECK=PASS`, `CLEAN_ORGANISM_SMOKE=PASS`, strict substrate wiring/restore, 30-cycle stop/re-init, UI build/typecheck, owner-approval E2E, все три Research Bridge probes, P23 candidate staging/promotion, WorkPass110/108, P26 и progress-ledger integrity. Полные links и testedHead сохранены в JSON ledger; все CI entries привязаны к одному SHA.
- Ранее опубликованный основной ZIP остаётся WorkPass70 Hotfix1 от 19 октября 2026 года. Новый ZIP не пересобран и не опубликован; главная ветка не менялась.

## Незакрытые релизные ворота

1. Независимый, не использованный для настройки holdout benchmark для tool-use, transfer и retrieval на нескольких парных seed-ах.
2. Доказательство полного пути реального принятого действия: план → gateway → фактический внешний postcondition → проверенная причинная привязка → learning credit.
3. Подтверждённая установка/сборка на чистой машине и целевом Android/Termux окружении.
4. Реальный браузерный UI, Live2D, голос/TTS и длительная синхронизация эмоций тела.
5. Длительный restart/soak test, полная лицензия/provenance проверка исходных источников и воспроизводимая пересборка главного release ZIP.

Панель разделяет «код есть», «контракты проверяются», «есть независимые полевые результаты» и «готово к релизу», чтобы одна цифра не скрывала незакрытые области.
