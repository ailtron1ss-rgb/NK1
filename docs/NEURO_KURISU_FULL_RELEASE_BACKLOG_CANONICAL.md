# Neuro-Kurisu — канонический backlog (WorkPass57, 17.10.2026)

**Текущая база:** `Neuro_Kurisu_WORKPASS56_2026-10-17.zip` → результат `Neuro_Kurisu_WORKPASS57_2026-10-17.zip`. **Runtime:** `35.77.0` / schema `225`. **Статус:** implementation workpass; release approval не заявляется. Детальная дельта пробелов: `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS57.md`; историческая карта WorkPass56 сохранена отдельно.

## WorkPass57 — достоверность внешнего результата, durable idempotency и late evidence (2026-10-17)

- **DONE — code:** `OutcomeVerificationService` и причинный projection boundary не допускают повышения `tool-contract` ACK до независимого внешнего доказательства; для результата проверяются валидные bounded observation ID и ожидаемое/наблюдаемое postcondition.
- **DONE — code:** `ActionGateway` получает `executed-contradicted`: ответ исполнителя при несовпадающем внешнем состоянии не объявляется успехом. Явное противоречие различается от unknown/incomplete evidence.
- **DONE — code:** side-effecting/high-risk tool definitions выводят необходимость durable idempotency по действию, capability и permission class даже если старая регистрация не установила `requiresIdempotencyKey`. Неключевой mutation отклоняется до executor entry.
- **DONE — code:** bounded persisted executionId/fingerprint index и causal outcome directory позволяют дедуплицировать replay и прикреплять задержавшееся observation после вытеснения recent history и migration.
- **DONE — evidence policy:** sourceId/sourceClass/independenceKey/assessment сохраняются в записи. Tool ACK и single-source negative evidence не создают credit; отрицательное обучение требует не менее двух независимых высокоуверенных contradictory lineages, положительное — идентифицированный independent external source с достаточной уверенностью. Unknown не засчитывается как некомпетентность.
- **DONE — audit infrastructure:** архитектурная проверка учитывает реальные cross-package app/runtime imports; release-contract/source, source hygiene, integrity and executable syntax audits синхронизированы с runtime `35.77.0` / schema 225.
- **EVIDENCE:** `npm run test:workpass57` прошёл typecheck, outcome hardening, idempotency, migration/late evidence, crash reconciliation, 9 receipt integration cases, 5 provider reconciliation cases и WorkPass56 memory indexing/privacy regressions.
- **PARTIAL:** симулированный receipt/restart/reconciliation path проверен, но живой device/provider postcondition и реальное обучение на внешней среде не подтверждены.
- **OPEN:** Production Vite/browser/Live2D E2E; target-provider/device full loop; независимый retrieval holdout (сейчас `recallDelta=0`, candidate не promoted); target-hardware inference; phoneme/audio-buffer lipsync; clean-room rollback; nested-source license sign-off; endurance soak. Официальная готовность остаётся **78.0%**.

---

## WorkPass56 — отложенная индексация MemoryOS2 без второго владельца (2026-10-17)

- **DONE — implementation:** existing `MemoryFabric.maintain()` schedules one bounded semantic-index batch when `NK_EMBEDDINGS_RUNTIME_ENABLED=1`; canonical memory writes remain synchronous and never wait on embeddings.
- **DONE — provider control:** only eligible active, non-quarantined memories enter batches; vectors are validated and indexed only if the memory content hash still matches on return. Derived vectors stay in a bounded transient cache, with retry backoff tied to memory ID + content hash.
- **DONE — privacy boundary:** `LocalEmbeddingProvider` redacts common credentials/API keys, bearer tokens, private keys, email, phone-like values, credentialed URLs and long numeric IDs before cache keys or provider requests; redaction count is aggregate-only. This remains a heuristic, not full PII classification.
- **DONE — integration:** live cognition, Memory Inspector semantic queries and background maintenance share one serialized local-provider lane. If the provider is busy or unhealthy, cognition uses the canonical lexical/fuzzy result; memory writes continue. Safe aggregate diagnostics are available through the existing Memory Inspector route/panel.
- **SOURCE-DERIVED:** adapted deferred batching/retry from retained Hexis MIT `services/memory_embeddings.py`; no second canonical store, extra database or parallel memory runtime was introduced.
- **PARTIAL — target provider:** local Ollama/llama.cpp model runtime and performance on the target device remain unverified; feature is opt-in and defaults off.
- **OPEN:** broad retrieval still `recallDelta=0`; independent labelled holdout, Vite/browser/Live2D E2E, live provider/device receipt-to-Reafference flow, phoneme audio sync, safe self-modification rollback, clean-room recovery, exhaustive nested-source license sign-off and soak remain open. Official readiness remains **78.0%**.

---


## WorkPass55 — кросс-языковой retrieval и восстановление orphan approvals

- **DONE — code:** Action Approval Center получает настоящий серверный snapshot `ActionGateway` и после открытия/возврата вкладки обнаруживает pending tickets без локального continuation. Пользователь может явно отозвать ещё ожидающий ticket. Сырые исходные тела запросов не сохраняются и не выполняются автоматически после reload.
- **DONE — code:** MemoryOS2 использует предвычисленные EN/RU concept token groups, распознаёт вопросы о любопытстве, личности, целях и причинах; расширение низковесными aliases балансируется между активными концепт-группами, сохраняя исходные токены, temporal/epistemic guards и единственного владельца памяти.
- **PARTIAL — retrieval uplift:** контролируемые русско-английские перефразирования находят заданные воспоминания; широкий benchmark на 8 holdout still `recallDelta=0` с ceiling Recall@5. Алгоритм не promoted; нужен независимый labelled hard-negative holdout.
- **FIXTURE:** candidate coverage использует explicit `temporalMode: 'at'` для исторического запроса с фиксированным timestamp; режим `current` намеренно привязан к системному времени.
- **OPEN P0:** installed Vite production build + browser E2E; долгий live-provider autonomous run; внешние postcondition receipts/reconnect/ambiguity → Reafference → causal credit → MemoryOS2; target-device inference.
- **OPEN P1/P2:** audio-buffer/phoneme lip-sync; независимый retrieval holdout; безопасная самомодернизация с explicit approval/rollback; clean-room restore/rollback; exhaustive nested-source licenses; multi-hour soak. Официальная готовность остаётся **78.0%**.

---

# Neuro-Kurisu — канонический backlog (WorkPass50, 16.10.2026)

**Текущая база:** `Neuro_Kurisu_WORKPASS49_2026-10-16.zip`. **Runtime:** `35.71.0` / schema `225`. **Статус:** implementation workpass; релиз не подтверждён. Подробная карта 36 пробелов актуализирована в `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS50.md`.

## WorkPass50 — цель → интерес → обратная связь → непрерывность runtime

- **DONE — code:** unified P33 personal-interest profiles now accept idempotent evidence from active goals, retained memory/learning records, self-authored goals, chosen topics and explicit feedback scoped to a previously delivered topic. Positive/engaged responses strengthen only a matched domain gently; negative feedback nudges that domain down without rewriting core traits. Evidence IDs/source provenance persist through restore.
- **DONE — runtime fix:** only actual inbound text is treated as a conversation input for autonomous quiet-time/relationship update; background cognition no longer simulates user interaction and suppresses spontaneous initiation.
- **DONE — end-to-end runtime seam:** background `OrganismRuntime` scheduler reaches configured fake language invoker; a message moves to durable `ready`, is acknowledged once by UI, explicit user response feeds back to canonical interest, durable flush/restoration succeeds and the delivered message is not replayed. A second test exercises the actual clock with auto-run. This does not count as a live provider session.
- **PARTIAL — embodied speech:** `AvatarStage` includes opt-in native speech, voice selection/cancel, emotion/intent-linked view state and approximate word-boundary mouth shaping into Live2D. Browser Vite build, actual viewer protocol, and phoneme/audio-buffer synchronization remain open.
- **KEEP OPEN — not reduced to checklists:** actual provider/browser run, memory retrieval improvement (current `recallDelta=0`), real receipt/Reafference/credit loop, target-device inference, safe self-modification with approval/rollback, source license sign-off and soak.
- **PASS CRITERIA:** no repeat-message after restart, actual clock proceeds without synthetic user input, only scoped explicit response affects the profile, and no unsourced claims of subjective consciousness.

---

# Neuro-Kurisu — канонический backlog (WorkPass49, 16.10.2026)

**Текущая база:** `Neuro_Kurisu_WORKPASS48_2026-10-16.zip`. **Runtime:** 35.70.0 / schema 225. **Статус:** implementation workpass; релиз не подтверждён. Полная карта недостающих возможностей: `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS49.md` (36 пронумерованных областей с текущим состоянием и критериями закрытия).

## WorkPass49 — единая граница приватности provider-контекста

- **DONE — code:** применён общий фильтр к сохранённым сводкам памяти, known-entity фактам и world facts перед обычным когнитивным prompt, автономным диалогом и cognitive-proposal. Опасные записи исключаются целиком; безопасные остаются в контексте.
- **DONE — code:** при restore persisted social initiatives небезопасная тема/реплика удаляется; pending entry переводится в `deferred`, опасный готовый текст нельзя повторно доставить после рестарта.
- **DONE — code:** перед тем как самостоятельная реплика становится `ready`, сгенерированный текст проходит отдельную проверку. Отвергнутый текст не передаётся UI и не удерживает очередь в бесконечном retry. `OrganismCore` сохраняет `deferred` даже при `stageMessage=false`, а очищенная очередь записывается в state сразу после восстановления.
- **DONE — tests:** focused regressions охватывают credentials/email patterns в обычной памяти, известных фактах, world facts, restored queue и outgoing proactive message; положительный контроль подтверждает сохранность безопасных фактов. Core persistence regression подтверждает, что опасная строка не остаётся в snapshot и отказ корректно переживает checkpoint. Runtime typecheck и общий `audit:workpass49` проходят.
- **PRESERVED:** MemoryOS2 как единственный writable memory owner; существующие `AutonomousSocialInitiativeEngine`, language budget, Legacy, Live2D, четыре исходных `.7z` и schema 225.
- **OPEN P0:** фильтр эвристический, нужен полный data classification/provider consent; production Vite build и браузерный E2E; длительный idle-run с реальным provider; реальные external receipt → Reafference → temporal credit.
- **OPEN P1:** audio/viseme E2E, local inference на target host, независимый retrieval holdout, clean-room rollback, ручной nested-license sign-off и soak. Weighted roadmap остаётся 78.0%.

---

# Neuro-Kurisu — канонический backlog (WorkPass48, 16.10.2026)

**Текущая база:** `Neuro_Kurisu_WORKPASS47_2026-10-16.zip`. **Новый runtime:** 35.69.0 / schema 225. **Статус:** implementation workpass; релиз не подтверждён. Предыдущие проходы сохранены ниже как история.

## WorkPass48 — самостоятельные темы с опорой на память и аффект

- **DONE — topic ranking:** существующий `AutonomousSocialInitiativeEngine` ранжирует пригодные темы по значимости, свежести и источнику; `OrganismCore` передаёт активные цели и подтверждённые воспоминания типов `pattern`, `goal-learning`, `self-model` вместе с текущей рефлексией и любознательностью.
- **DONE — novelty:** введено сравнение тем по семантическому пересечению токенов с 14-дневным окном; если все темы повторяются или непригодны, движок не объявляет резервный шаблон новой мыслью.
- **DONE — affect → expression:** текущая appraisal-запись эмоции влияет на ограниченную подсказку тона; она временная и не меняет канонический профиль личности.
- **DONE — truthful feedback:** ACK интерфейса означает только доставку и больше не повышает социальную взаимность. Реакция пользователя должна подтверждаться отдельным реальным входом.
- **DONE — tests:** WorkPass48 topic/prompt regressions, trait-salience, personhood restore, social consolidation, server import/linkage audits и release-metadata contract проходят.
- **OPEN P0:** подключённый language provider и длительное ожидание инициативы с UI restart/replay; production Vite build и браузерный Live2D E2E; фактическая синхронизация по аудио/visemes; device/provider receipt → Reafference → temporal credit.
- **OPEN P1:** независимый retrieval holdout (подтверждённого uplift нет), target-host inference, clean-room rollback, ручной review лицензий вложенных источников и длительный soak. Weighted roadmap остаётся 78.0%.

---

# Neuro-Kurisu — канонический backlog (WorkPass47, 16.10.2026)

**Текущая база:** WorkPass46. **Новый runtime:** 35.68.0 / schema 225. **Статус:** implementation workpass; релиз не подтверждён. Для истории предыдущих проходов см. архив ниже.

## WorkPass47 — самостоятельная тема разговора доходит до UI

- **DONE — engine:** социальная инициатива связана с предметными темами, выбранными по активным целям, текущему домену и рефлексии; введены стартовая задержка, quiet period, cooldown и миграция прежнего persisted state. Нет фиктивного контакта `ambient-network`.
- **DONE — language:** внутренний предмет разговора передаётся в prompt с сохранением канонического persona prompt и контекстного бюджета. Язык — только текст; генератору явно запрещены инструменты, поиск, изменение файлов и устройства в рамках этой реплики.
- **DONE — delivery:** pending message сохраняется как `ready`; API выдаёт её UI; UI вставляет её по стабильному ID и подтверждает после локального сохранения. Повторное получение/подтверждение идемпотентно.
- **DONE — decisions:** создан `docs/NEURO_KURISU_VISION_AND_66_DECISIONS_WORKPASS47.md`, где есть ответы на все 66 вопросов. Прямые ответы пользователя маркируются отдельно от рекомендаций по пропущенным вопросам.
- **EVIDENCE — pending:** нужен запуск и реальный idle-period E2E с подключённым language provider, Vite/browser Live2D и restart/replay; это не подтверждено только typecheck/unit contracts.
- **NEXT P0:** production Vite build + реальный браузерный Live2D/idle-dialogue E2E; проверить actual model/voice synchronization, restart/replay и delivery ACK под работающим provider. Затем замкнуть outcome → Reafference → temporal credit → checkpoint на реальном, независимо проверяемом результате.
- **NEXT P1:** связать динамику аффекта с темпом/микродвижениями и индивидуальным телесным паттерном; укрепить MemoryOS2/MemoryFabric consolidation и причинно обусловленное обучение; продолжить избирательное внедрение открытых источников после review лицензий и единственного владельца.

---

# Neuro-Kurisu — канонический backlog (WorkPass46, 16.10.2026)

**Каноническая база этого прохода:** `Neuro_Kurisu_WORKPASS45_2026-10-15.zip`. **Новый runtime:** 35.67.0 / schema 225. **Статус:** implementation workpass; релиз не подтверждён. Исторические разделы WorkPass42 и ранее сохранены ниже как история, а не как утверждение, что их номера версий являются текущими.

## WorkPass 46 — детерминированный Live2D и уточнение требований

- **DONE — код:** активный `app/public/live2d/viewer.html` больше не загружает Pixi/Cubism из CDN при отсутствии локального файла. Используются только vendored assets из архива; при отсутствии файла ошибка становится видимой, а `AvatarStage` сохраняет Legacy fallback. Это убирает скрытую смену исполняемого кода и зависимость от сети для штатного запуска.
- **DONE — требования:** добавлен `docs/NEURO_KURISU_66_PROJECT_QUESTIONS_WORKPASS46.md` с 66 отдельными вопросами о личности, памяти, мышлении, автономности, UI/Live2D, моделях и целевом оборудовании.
- **DONE — метаданные:** root/runtime version, release contract, lockfile и integration manifest выровнены на WorkPass46 / 35.67.0 / schema 225.
- **ОТКРЫТО:** production Vite build и браузерный Live2D E2E; реальный camera/device/provider receipt и reconnect/replay; целевой local inference; независимый temporal-memory holdout; clean-room rollback; ручная проверка лицензий вложенных источников; длительный soak.
- **Следующий кодовый приоритет:** доказать сквозную цепочку `decision → ActionGateway receipt → exact execution correlation → verified observation → causal projection → temporal credit → checkpoint`, после чего интегрировать только те дополнительные механизмы из исходников, для которых обнаружен конкретный разрыв в текущем runtime.

---

## WorkPass 42 — каноническая очистка и сохранение всех исходных байтов (14.10.2026)

- **DONE:** убрать 21 идентичную Live2D-копию из `app/public`, оставив `runtime/neuro-kurisu/public/live2d` единственным файловым владельцем; Vite wrapper восстанавливает shadows по SHA-256 перед dev/build, clean удаляет только неизменённые exact copies.
- **DONE:** удалить два Lumina/Letta ZIP-алиаса и 27 одинаковых Kurisu v9/v56 файлов, сохранив canonical архивы/файлы и точный обратный путь через manifest.
- **DONE:** переместить 68 устаревших root-отчётов в `docs/history/` без изменения байтов; удалить 27 совпадающих forensic-history представлений; 56 пропущенных path-копий восстанавливаемы.
- **DONE:** сохранить точные исторические байты через immutable blob/reconstruction manifests; исходные архивы проверены 8,512/8,512, снимок 2026-10-06 — 10,427/10,427, Legacy dedup manifest — 3,873/3,873 без missing/conflicts.
- **DONE:** склеить 5 одинаковых immutable payload blobs между двумя каталогами в один hash-addressed источник (31,893 raw bytes saved); встроенный runtime ReleaseContract выровнен с `35.63.0` и общей фазой `WorkPass41/Causal-Cycle-Memory-NetValue`.
- **DONE:** финальная архитектура: 1,878 source files, 581 canonical, missing=0, cycles=0, legacyLeakage=0; hygiene 3,998 files / 0 errors / 0 warnings; syntax 1,318 JS, 6 shell, 247 JSON. App scripts 218/218, browser-smoke 51/51, metadata 34/34, metadata contract 6/6.
- **KEEP BY DESIGN:** 18 groups / 39 extra paths / 91,244 raw bytes remain because file paths encode separate duties/provenance (per-package LICENSE/SOURCE notices, SQL bootstrap vs migration entrypoints, named test fixtures, Python `__init__.py` markers, version-labelled evidence). No remaining group was deleted solely on hash equality.
- **P0 OPEN:** installed Vite production build + browser Live2D E2E; real provider/device receipts and reconnect/replay; clean-room install/upgrade/fault-injected rollback; real local inference; independent labelled temporal retrieval holdout (uplift remains 0); soak and manual nested-license sign-off.

**Прогресс cleanup-pass:** 94/100. **Взвешенная готовность дорожной карты:** 78.0% (без искусственного роста за переукладку файлов). This is not release approval or evidence of subjective consciousness.

---

# Neuro-Kurisu — полный актуальный backlog до готовности (WorkPass 42)

**Основа:** WorkPass 42, 14 октября 2026 года. **Runtime:** Neuro-Kurisu 35.63.0 / schema 225. **Статус:** implementation workpass; релизные блокеры открыты. Это план завершения, а не заявление о готовности. Каноническая копия сохраняет историю предыдущих проходов; текущая матрица интеграции: `INTEGRATION_MATRIX_WORKPASS42_2026-10-14.md`.


## WorkPass 41 — завершённый implementation pass и оставшиеся P0 (14.10.2026)

- **DONE:** текущий cognitive cycle теперь проходит отдельную causal verification по шести stage IDs, единому tick и обязательным родительским рёбрам. Глобальные dangling parent refs от вытесненных старых записей не могут ни подтвердить, ни испортить новый цикл. В обеих активных точках оценки — runtime operational loop и `OrganismCore.feedback` — используется один `CognitiveEventFabric.verifyOperationalCycle`.
- **DONE:** восстановление `CognitiveEventFabric` нормализует persisted events: неизвестные стадии, дублирующиеся IDs, отрицательные/нечисловые ticks и неполные структуры отбрасываются; confidence и payload нормализуются, валидные исторические идентификаторы сохраняются.
- **DONE:** `MemoryRetentionEconomy` теперь использует чистую ценность, harm/redundancy и provenance в базовом решении retention даже без давления на storage budget; byte pressure дополнительно корректирует value-per-byte. Исправлен подтверждённый регресс, из-за которого дорогие почти дублирующиеся записи оставались dormant.
- **EVIDENCE:** цикл/restore 10/10; retention net-value 5/5; big-pass 162/164 PASS; адаптивное удержание 2888/2894 PASS; memory-substrate indexed-vs-brute-force эквивалентность PASS; runtime TypeScript PASS.
- **P0 OPEN:** production Vite build и настоящий браузерный Live2D E2E; авторитетные receipts реальных устройств/провайдеров и reconnect/replay; clean-room install → upgrade → fault-injected partial commit → rollback → byte/state verification.
- **P1 OPEN:** inference на целевом llama.cpp-хосте, независимый размеченный temporal retrieval holdout (uplift пока нулевой, кандидат не продвигать), семантическая проверка критических функций, длительный soak и ручная лицензия/NOTICE sign-off для вложенных source archives.

**Прогресс implementation pass:** 92/100. **Взвешенная дорожная карта:** 78.0%. Это не разрешение на релиз.

---

## WorkPass 40 — закрытые изменения и актуальные P0 (14.10.2026)

- **DONE:** `restoreBackup` atomically acquires the runtime maintenance lock, verifies staged bytes, rejects symlinked backup/live state entries and symlink backup directories, restores the exact supported file set, retains pre-restore backup and attempts rollback on partial commit. Regression suite: 9/9.
- **DONE:** CycloneDX 1.5 SBOM records 464 locked npm components, declared license/integrity data, seven repository license/notice files and ten embedded source archives with SHA-256/member-count evidence. Manual review of nested licenses remains open.
- **DONE:** a loopback-only OpenAI-compatible `llama.cpp` adapter is integrated into P40 Model Ecology. It caps the response body at 2 MiB, rejects redirects, merges the provider default into old snapshots and reports configuration as unverified until actual inference succeeds. No weights are bundled; target-device inference remains open.
- **DONE:** root/release/runtime metadata aligned to WorkPass 40 / runtime 35.62.0 / schema 225. Primary audit passes; app scripts 212/212; browser-smoke contract 51/51; action archive 4/4; ActionGateway 13/13; WILL 17/17; server smoke PASS.
- **P0 next:** app dependency install + full Vite production build + real browser/Live2D E2E. The current environment lacks `app/node_modules/.bin/vite`; `npm run build` exits with `spawn vite ENOENT`.
- **P0 next:** run `llama.cpp` against an actual target-host model, measure latency/RAM/VRAM and cancellation; do not promote capability from configuration alone.
- **P0 next:** real provider/device receipts, reconnect/replay, and clean-room upgrade/restore/rollback with a commit failpoint.
- **P1 next:** independent labelled temporal-memory holdout; synthetic recall uplift remains zero and the candidate is not promoted. Long-duration soak, critical-function behavioral evidence and nested-source license sign-off remain open.

**Прогресс прохода:** 82/100; **взвешенная дорожная карта:** 77.2%. Не является разрешением на релиз.

---

## WorkPass 35 — закрытые изменения и приоритеты

- **DONE:** WILL competence only learns from verified outcome evidence (`verifiedUses`); unverified success cannot raise skill success-rate/confidence. Legacy snapshots without a verified ledger restore with neutral confidence and zero credited success. Regression suite 17/17, runtime typecheck and organism smoke pass.

- **DONE:** WILL rank/utility/confidence adjustment moved before canonical P69 arbitration; ±0.04 bounded effect and true baseline/delta diagnostics. P69 remains the only final choice/veto owner. Dedicated bridge tests 17/17 and runtime TypeScript typecheck pass.
- **DONE:** exact duplicate expanded source/snapshot representations replaced by immutable SHA-256-verifiable ZIPs plus `tools/materialize_legacy_archive.py`. Restoration reproduces WILL (606 files) and Neuro-Kurisu 35.30 (4,022 files) byte-for-byte. Exact duplicate Lumina/Letta ZIP aliases removed; canonical archives remain.
- **DONE:** release metadata aligns to root `35.0.0-super-final21`, runtime `35.58.0`, schema 224, WorkPass35. The weighted readiness score stays 72.9%.
- **P0 next:** attach WILL outcome/competence projections to the canonical verified ActionGateway receipt/idempotency loop; prevent replay/double credit and prevent unverified successes from training competence.
- **P0 next:** unify WILL vector retrieval with canonical MemoryFabric/MemoryOS2; keep synthetic hash vectors clearly marked as fixtures, not semantics.
- **P0/P1 next:** collapse competing transport/outbox/idempotency ownership; then complete true local inference, independent temporal holdout, browser/Live2D E2E and clean-room recovery/rollback/soak.

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


## WorkPass 36 — unified primitives, memory lineage and immutable source history (13.10.2026)

- **DONE (implementation):** shared `NumericPrimitives` now supplies FNV-1a and cosine similarity to modules with identical math; old epsilon floors remain explicit, and non-equivalent L1 distance was not merged.
- **DONE (implementation):** identical action-cost tables are centralized in `ActionCostPolicy` for OrganismCore, ParametricPolicyLearner, ActiveInferenceEngine and ContextualWorldModel. Distinct domain-specific experiment costs remain separate.
- **DONE (implementation):** stable serialization and SHA-256 helper is shared across WILL, Letta, Lumina, Hexis and Conscio. JSON serialization and historical fingerprint serialization are separately named so persisted digest contracts remain compatible.
- **DONE (memory durability):** MemoryOS2 revision history is bounded to 64 entries per memory, reason strings are capped at 240 characters, restored trails are normalized, and history contributes to estimated memory bytes.
- **DONE (legacy integration):** MemorySubstrateCoordinator preserves legacy source-event/association provenance through canonical conversion and compatibility projection without inserting unresolved legacy IDs into canonical MemoryOS2 links.
- **DONE (archive integrity):** compacted source archives resolve to immutable content-addressed blobs; 8,512/8,512 archive members passed SHA-256 checks; 10,427 historical snapshot entries and 3,873 legacy dedup manifest entries were reconciled.
- **DONE (integration map):** source branches are classified as adapted, compatibility projection, research-only or immutable provenance in `INTEGRATION_MATRIX_WORKPASS36_2026-10-13.md`; this prevents an archive's mere presence being mistaken for active implementation.
- **Regression evidence:** runtime TypeScript, shared serialization contract, WAS integration suites, bounded memory-history and legacy lineage tests pass. Previous broader structural audits reported missing=0, cycles=0, legacyLeakage=0 and asset audit `errorCount=0`.
- **Not claimed:** overall release score remains **72.9%**. Full app dependency-installed typecheck/production build and browser Live2D E2E, real model/provider inference, independent labelled retrieval holdout, cross-provider action/postcondition/reafference, clean-room rollback and soak remain open.


## WorkPass 37 — durable action receipts, verified reafference and schema 225 (13.10.2026)

- **DONE:** persistent ActionGateway receipts and deterministic idempotency through direct tools, skills and project APIs; key/request conflicts and uncertain post-action persistence fail closed.
- **DONE:** independent external postcondition evidence flows through ExternalObserverFabric; exact caller-supplied decisionId gates temporal credit and duplicate replay does not repeat learning.
- **DONE:** ReleaseContract/package/manifest align to 35.59.0/schema 225; migration from schemas 223 and 224 tested, including receipt-ledger default/preservation.
- **DONE, non-promotion:** retrieval benchmark now compares baseline/candidate at the same explicit historical instant; synthetic uplift remains 0 and candidate remains not-promoted.
- **OPEN P0:** real provider/device receipts and reconnect/replay; independent labelled temporal memory holdout; dependency-installed React/Vite build and browser Live2D E2E; clean-room recovery/rollback; multi-hour soak and final SBOM/license/provenance.
- **Reference:** `WORKPASS37_REPORT_2026-10-13.md`, `WORKPASS37_TASKS_2026-10-13.md`, `INTEGRATION_MATRIX_WORKPASS37_2026-10-13.md`.


## WorkPass 39 — cognitive system unification and evidence identity (2026-10-14)

- **DONE:** New `ExternalObserverFabric`, `ExternalEvidenceTrust` and `EvidenceFirewall` identities use canonical SHA-256; pre-existing FNV IDs are retained when a matching historic row is found, avoiding duplicate memories/evidence after restore.
- **DONE:** `CognitiveNetworkBus` now incorporates confidence and energy cost into its bounded utility; same-specialist collisions are reduced by effective utility instead of raw score. Unknown specialist names and non-finite state remain rejected/normalized.
- **DONE:** `CognitiveArchitectureMap` makes the main state authority, writable-memory authority, final action arbiter, side-effect gateway, external-evidence verifier and research promotion boundary explicit; 14 subsystems / 22 directional flow contracts refer to existing modules.
- **DONE:** `OrganismCore` attaches live composed-system health to the read-only architecture endpoint; Runtime Atlas renders subsystem cards, owner, outputs, dependencies, flow categories and the live system snapshot.
- **DONE:** Reviewed 15 public upstream repositories/docs; recorded license/status caveats, useful patterns and non-promotion reasons. No external git clone or binary download is claimed because the work container could not resolve GitHub from shell.
- **NOT PROMOTED:** Mem0/vector-store/FAISS/third-party agent orchestration are not added as a second memory or agent runtime; the current retrieval experiment still shows zero uplift.
- **OPEN:** Installed Vite build and browser Live2D E2E, real local inference, independent labeled temporal holdout, external provider receipts/reconnect, clean-room recovery/rollback and soak.

## WorkPass53 — Explicit one-time action approval boundary (2026-10-16)

- [x] ActionGateway persisted exact-request approvals with TTL, operation/decision/output binding, serialized creation and one-time consumption.
- [x] Voice, speech response, primary and legacy outbound, and research bridge subprocess side effects block without owner approval.
- [x] Operator Console exact-input approve-and-run-once UI; Runtime Atlas cross-surface review queue.
- [x] Safe approval preview redacts bearer/secret URL parameters, URL userinfo, email and phone-like values.
- [x] Process-level runtime + Python bridge proves no-run-before-approval and replay denied.
- [ ] Production browser/live provider/device testing, full rare-surface approve/retry UX, clean-room rollback, full nested source license review and soak remain open. Official weighted roadmap score remains 78.0%.



## WorkPass 54 — universal one-time approval continuation (2026-10-17)

- [x] Added a global app-root `ActionApprovalCenter` fed by the existing canonical ActionGateway challenge; all structured 403 `approvalRequired` POST responses with JSON object bodies can suspend the original client call and appear as a safe approval card.
- [x] Approval resolves the durable runtime ticket, then retries the captured original route/body once with `approvalId`; the raw JSON body stays in browser-tab memory only, never localStorage/sessionStorage or the server queue.
- [x] Declines, expiry, duplicate live continuation IDs and replayed UI decisions do not resume side effects; the originating caller gets a truthful failure instead of success.
- [x] Runtime Atlas is now a read-only queue/audit view. Removed its competing resolve controls, which could race against the suspended request's continuation and consume its ticket before retry.
- [x] Added an application-level approval center component and broker, with visible redacted parameters, expiry, state, approve-once and decline actions. Legacy IntegrationConsole/ResearchDock handlers remain as fallback when an endpoint cannot be automatically resumed.
- [x] Adapted the fail-closed, no-approver-means-no-consent lesson in the included Hexis source (`core/tools/policy.py`, `tests/core/test_approval_gate.py`) without carrying over its implicit CHAT approval exception. Source remains under MIT license in immutable `legacy/input-archives/hexis-main-2026-10-08/`.
- [x] Added `test:workpass54-approval-center` for queue publication, exact continuation once, decline, duplicate tickets and expiry.
- [ ] Browser E2E with installed app dependencies: approve/decline/expired/changed-body flows across chat, project tool, device and research surfaces.
- [ ] Reissue/clean up orphaned pending tickets after tab reload; current continuation intentionally is not persisted with the sensitive body, so the safe recovery is expiry and fresh request.
- [ ] Production Vite build, live provider/device postconditions, real audio-buffer lip sync, independent memory retrieval uplift, clean-room rollback, exhaustive nested-source license review and soak remain release gates. Weighted score remains 78.0%.
