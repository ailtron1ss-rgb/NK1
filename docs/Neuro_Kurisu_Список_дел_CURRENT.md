# Neuro-Kurisu — актуальная рабочая точка — WorkPass57 (17.10.2026)

**Канонический архив:** `Neuro_Kurisu_WORKPASS57_2026-10-17.zip` · **База:** `Neuro_Kurisu_WORKPASS56_2026-10-17.zip` · **Runtime:** 35.77.0 · **schema:** 225 · **Статус:** implementation workpass; релизные gates открыты. Исторические проходы ниже сохранены.


### WorkPass 57 — доверие к исходу, причинность и idempotency (17.10.2026)
- [x] `tool-contract` ACK нельзя выдать за независимое внешнее postcondition; противоречие является отдельным `executed-contradicted`, incomplete observation остаётся unknown.
- [x] `ActionGateway` применяет durable idempotency-политику к mutating/high-risk инструментам даже при неполном legacy registration.
- [x] `OutcomeCognitionFabric` и `CausalAccountabilityGraph` сохраняют ограниченные correlation indexes; late evidence после кольцевой ротации/миграции прикрепляется к точному `executionId`, replay дедуплицирован.
- [x] Source class, source ID, independence key и assessment проходят через outcome records и migration; single-source contradiction не присваивает отрицательный learning, для него нужно два независимых достаточно уверенных источника.
- [x] TypeScript typecheck; WorkPass57 execution/receipt/reconciliation/memory/privacy tests; release source/contract, hygiene, integrity, syntax and architecture audits проходят.
- [ ] Реальный device/provider side effect → независимый read-after-write → crash/restart → reconciliation → credit.
- [ ] Production Vite + browser/Live2D E2E, local target-model profile, phoneme/audio-buffer sync, retrieval holdout, clean-room rollback, nested-license review и soak.
- **Взвешенная готовность релиза: 78.0%**; метрика не увеличена без закрытых live gates. Подробности: `docs/WORKPASS57_CODE_CHANGES_2026-10-17.md`, `docs/WORKPASS57_HANDOVER_2026-10-17.md`, `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS57.md`.

---

### WorkPass 42 — итоговая очистка и каталогизация
- [x] Единственный канонический владелец Live2D — `runtime/neuro-kurisu/public/live2d`; 21 копия в `app/public` безопасно восстанавливается перед Vite и удаляется после проверки/сборки.
- [x] Удалены только точные пути-дубликаты: два ZIP-алиаса, 27 v9/v56 source copies, 27 исторических копий; 56 путей восстанавливаются из manifest.
- [x] 68 исторических отчётов вынесены из корня без изменения байтов; текущая навигация/отчёты централизованы в `docs/`.
- [x] 7 осиротевших старых blobs удалены лишь после перепривязки manifests и проверки 8,512/8,512 архивных элементов и 10,427/10,427 snapshot records.
- [x] Пять одинаковых immutable payload copies объединены в один файл (31,893 байта); ReleaseContract исправлен и совпадает с runtime 35.63.0.
- [x] Финальная классификация: 9,139 базовых путей учтены — перенесённые, восстанавливаемые дубли, генерируемые asset shadows или superseded blobs; необъяснённых удалений 0.
- [x] App scripts 218/218, browser-smoke contract 51/51, metadata 34/34, metadata contract 6/6, SBOM/provenance 1/1; architecture 0 missing/cycles/legacy leakage.

### Открытые реальные gates (не скрывать)
- [ ] Vite production build и интерактивный browser/Live2D E2E в окружении с установленными lockfile dependencies.
- [ ] Реальные provider/device receipts, reconnect/replay и reconciliation неопределённых действий.
- [ ] Независимый labelled retrieval holdout: uplift остаётся 0, candidate не promoted.
- [ ] Clean-room install/upgrade/rollback, soak, local inference на целевом железе, ручная проверка вложенных лицензий.

**Прогресс прохода очистки:** 94/100. **Взвешенная готовность релиза:** 78.0%.

---

### WorkPass 41 завершено
- [x] Проверка причинной цепочки текущего когнитивного цикла по шести стадиям, общему tick и обязательным рёбрам; старые dangling-ссылки кольцевого журнала не портят валидный текущий цикл.
- [x] Восстановление событий отклоняет неизвестные стадии, повторные ID и некорректные поля, не меняя валидные исторические идентификаторы.
- [x] `MemoryRetentionEconomy` оценивает чистую ценность, вред, дублирование и provenance до учёта давления бюджета; value-per-byte используется как дополнительное ограничение при дефиците памяти.
- [x] Регрессионные сценарии cycle restore (10 assertions), retention net-value (5 assertions), `big-pass-162`, `big-pass-164`, anti-collapse, adaptive economy и memory-substrate equivalence прошли.
- [x] Root/runtime release metadata и provenance согласованы на WorkPass41 / runtime 35.63.0 / schema 225.

### Открытые release gates
- [ ] Зафиксированные app-зависимости, полный Vite production build и интерактивный browser/Live2D E2E. Установка `npm run install:all` превысила доступное время; Vite в offline-кеше отсутствует.
- [ ] Реальные receipts внешних исполнителей, reconnect/replay и reconcile неопределённых операций.
- [ ] Clean-room install → upgrade → fault-injected rollback с проверкой байтов состояния.
- [ ] Реальный llama.cpp inference на целевом железе и измерение latency/RAM/VRAM/cancellation.
- [ ] Независимый размеченный temporal retrieval holdout: текущий recall uplift равен нулю, поэтому кандидат не promoted.
- [ ] Поведенческие доказательства критических функций, длительный soak и ручное согласование лицензий вложенных исходников.

**Прогресс реализации WorkPass41:** 92/100. **Взвешенная дорожная карта релиза:** 78,0%. Это не означает готовность к релизу.

---

# WorkPass 37 — статусные задачи (13.10.2026)

Progress 78/100. Prioritise real provider receipts, independent retrieval holdout, app build/browser Live2D E2E, clean-room rollback and soak. See `WORKPASS37_TASKS_2026-10-13.md`.

---

# Neuro-Kurisu — текущий рабочий список — WorkPass 35

**Канонический архив:** `Neuro_Kurisu_WORKPASS35_2026-10-13.zip`  
**Runtime:** 35.58.0 · **schema:** 224 · **статус:** implementation workpass, не release-ready.

## WorkPass 35 — текущая рабочая точка (13.10.2026)

### Завершено
- [x] WILL competence учится только на подтверждённых исходах (`verifiedUses`); неподтверждённые успехи не повышают success-rate/confidence, legacy snapshots без verified ledger мигрируют нейтрально.
- [x] WILL candidate scoring теперь выполняется до P69; P69 остаётся единственным владельцем финального выбора и veto.
- [x] Влияние WILL ограничено ±0.04; diagnostics сохраняет baseline до поправки и реальный delta.
- [x] WILL bridge integration: 17/17; runtime TypeScript typecheck и organism smoke: PASS.
- [x] Убраны только точные дубли: развёрнутые WILL (606 файлов), Neuro-Kurisu 35.30 (4 022 файлов), повторные Lumina/Letta ZIP. Оригинальные архивы сохранены; восстановитель проверяет SHA-256 и восстановил 606/606 и 4 022/4 022 файлов.
- [x] Размер архива сокращён примерно с 230.6 MB до 200.4 MB (на около 30.3 MB, около 13.1%), не затрагивая app UI, app sprites, runtime source или Live2D деревья, присутствующие в исходной базе.
- [x] Текущая инвентаризация deliverables: 64 DONE, 11 PARTIAL, 10 TODO; weighted score остаётся 72.9%, не означает готовность к релизу.

### Следующие приоритеты — реальная интеграция
- [ ] WILL competence/outcome подключить к canonical verified execution receipts и idempotency; исключить повторное начисление между reward/trust/causal consumers.
- [ ] Перевести WILL retrieval facade на единственный canonical MemoryFabric/MemoryOS2; hash-based vector оставить только для fixture/benchmark, не выдавать за semantic embedding.
- [ ] Свести transport/outbox/idempotency к одному владельцу; сохранить совместимые API и миграции.
- [ ] Получить live Ollama/llama.cpp inference и независимый labelled temporal holdout; не смешивать fixture results с реальной оценкой качества.
- [ ] Закрыть production Vite/browser/Live2D E2E, clean-room restore/rollback, soak, SBOM/provenance и итоговый sign-off.

## История предыдущих рабочих проходов (ниже сохранена без удаления задач)

## WorkPass 27 — компенсация составных действий и безопасный abort (11.10.2026)

**База:** WorkPass 26 · root `27.0.0-super-final14` · runtime `35.50.0` · schema `224`. **Статус:** implementation workpass, не release-ready.

- [x] ActionGateway принимает compensation-контракт только парой: `compensate` + `verifyCompensation`; инвентарь инструментов показывает наличие обоих обработчиков.
- [x] Компенсация привязывается к exact original execution ID с успешным audit receipt; повторный вызов отклоняется после первого запуска обратной операции. Это at-most-once guard только в текущем процессе, не distributed exactly-once.
- [x] Выполненные side effects журналируются в памяти выполнения только после bounded JSON snapshot (16 KiB на input/result); при невозможности безопасно сохранить payload эффект обозначается как неопределённый.
- [x] При провале позднего шага известные побочные эффекты откатываются в обратном порядке; только отдельная подтверждённая postcondition засчитывается как `compensated-verified`.
- [x] Throw-after-write и отсутствие/сбой compensation отмечаются как `partial`/`manual-intervention-required`; система не лжёт, что транзакция полностью отменена.
- [x] Добавлены прямые и сквозные сценарии: verified compensation, повторный вызов, rollback при недоступной зависимости, неоднозначный failure с требованием ручной сверки. Runtime TypeScript и `test:motor-schema-agency` проходят.
- [ ] Получить реальные pinned NLI inference/holdout metrics; DNS npm registry сейчас возвращает `EAI_AGAIN`.
- [ ] Установить UI зависимости в network-enabled clean environment, выполнить Vite production build и browser E2E.
- [ ] Провести независимый temporal MemoryOS2 holdout против BM25; текущий эксперимент не продвигается, так как CI допускает регрессию.
- [ ] Завершить clean-room restore/upgrade/rollback, soak, SBOM/provenance и release sign-off.

- [x] Корневой `npm run audit:workpass27` завершился с кодом 0; metadata 35/35; release-validator contract tests 7/7. Memory retrieval benchmark вынесен в отдельный `npm run audit:workpass27:memory` и в этом корневом запуске не объявляется пройденным.

**Счётчик WorkPass 27:** 2 новых deliverables G81–G82 закрыты; всего 82: 61 DONE, 11 PARTIAL, 10 TODO. В detailed backlog 195 пунктов: 18 DONE, 89 PARTIAL, 84 TODO, 4 BLOCKED. Weighted roadmap 72,35% — не процент готовности к выпуску.

---

## WorkPass 25 — калибровка NLI и сохранение provenance (11.10.2026)

- [x] Добавлен детерминированный fitter temperature scaling для существующего локального NLI batch endpoint; минимум 50 размеченных примеров на каждый из трёх классов.
- [x] Требовать явный источник датасета и протокол разметки; в отчёт записывать SHA-256 и метрики, но не тексты исходников.
- [x] Сделать публикацию артефакта приватной (0600), атомарной, без перезаписи по умолчанию; артефакт по умолчанию `promoted=false`.
- [x] Валидировать точные model ID/revision, порядок классов, dataset hash, размеры/классы выборки, температуру и eligibility перед применением в NLI service.
- [x] Передавать calibration dataset hash/method/temperature через claims, quotes, atoms и model-version key; проверять согласованность при restore, отклонять смешанные/подменённые метаданные.
- [x] Добавить тесты CLI, group-disjoint validation, артефакта и защиты от подмены метрик; service contract, NLI provenance и восстановление; `runtime tsc` и runtime implementation gate проходят.
- [ ] Запустить закреплённые настоящие pretrained weights и получить реальные калибровочные/holdout метрики. В текущем окружении загрузка модели блокируется DNS; mock-тесты не считаются доказательством качества.
- [ ] Убедиться, что calibration split отделён от final holdout и threshold tuning; проверить язык/домен и достаточность разметки.
- [ ] Закрыть production build React/Vite, desktop/mobile browser E2E, независимый MemoryOS2 temporal holdout, clean-room restore/rollback и soak.

**Результат WorkPass25:** 2 новых normalized deliverables закрыты (G76–G77); current inventory 77: 56 DONE, 11 PARTIAL, 10 TODO. Runtime NLI semantic 23; service 12/12; evaluator 4/4; calibration fitter 5/5. Проект остаётся implementation-workpass, не release-ready.
Версия контрольной точки: root `25.0.0-super-final12`, runtime `35.48.0`, schema 224.

---

## WorkPass 23 — батчевый NLI, безопасная загрузка и оценщик holdout (11.10.2026)

- [x] Базовый optional NLI cross-encoder с immutable revision, safetensors-only/no-remote-code и bounded local server.
- [x] Batch inference до 24 пар в canonical claim path; fallback на legacy single-only endpoint разрешён только при 404/405, не при overload/timeout.
- [x] Privacy-aware labelled holdout evaluator с хешем датасета, class metrics, Brier/ECE и приватным атомарным output.
- [x] Закрыть обход exact-only split leakage: обнаруживать почти одинаковые train/holdout queries с высокой 3-token-shingle схожестью; не сохранять тексты в diagnostics.
- [ ] Запустить реальные pretrained weights и fixed labelled holdout после доступности model/package registry; не заявлять качество по mocked backend.
- [ ] Получить независимый temporal MemoryOS2 holdout и доказать прирост против BM25/lexical baseline.
- [ ] Установить app dependencies и пройти React/Vite production build и browser E2E.
- Версия контрольной точки: root `24.0.0-super-final11`, runtime `35.47.0`. Статус остаётся implementation workpass, не release-ready.

| Изменение | Статус | Фактический результат / граница |
|---|---|---|
| Pin NLI model revision и запрет небезопасного fallback весов | DONE (код/контракт) | Зафиксирован commit `a150876415327c80daeff35ca6f68f5ed8cf5c24`; revision aliases запрещены, `trust_remote_code=False`, `use_safetensors=True`, проверяются ровно 3 ожидаемых label. Реальная загрузка веса блокирована DNS среды. |
| Пакетный inference в canonical research runtime | DONE | До 24 atom/sentence пар проходят одним `/v1/nli/batch`; старые backend без `evaluateBatch` сохраняют совместимый single-pair путь. |
| Ограничить одновременную нагрузку сервиса | DONE | Bounded worker semaphore, HTTP 503 + Retry-After при перегрузе, ограниченные CPU threads. |
| Создать holdout evaluator с метриками и защитой приватности | DONE | `tools/evaluate_research_nli.py`: dataset SHA-256, confusion matrix, per-class precision/recall/F1, macro-F1, Brier, cross-entropy, ECE; отчёт не содержит тексты; mode 0600; удалённый endpoint только с `--allow-remote` и HTTPS. |
| Прогнать настоящие pretrained weights на domain/adversarial holdout | TODO/BLOCKED | `pip install transformers/safetensors` не состоялся: DNS `EAI_AGAIN`; модель не была скачана, оценку реального качества не заявляем. |
| Production build React/Vite и browser E2E | TODO/BLOCKED | `npm --prefix app ci` завершился по таймауту, node_modules не установлены; нужен network-enabled clean build target. |

**Приёмка WorkPass23:** runtime TypeScript PASS; semantic NLI mocked integration 20; local service 9/9; holdout evaluator 4/4; app build и реальная модель остаются открытыми.

---

## WorkPass 22 — implementation update (11.10.2026)

| Изменение | Статус | Фактический результат / граница |
|---|---|---|
| Подключить опциональный NLI backend к `ProjectResearchSession` и каноническому runtime | DONE (интеграция) | `ResearchSemanticEntailment.ts` вызывает настроенный сервис, записывает модель/оценки/цитаты/атомы и валидирует их при restore. Базовый runtime не включает NLI по умолчанию. |
| Добавить локальный DeBERTa NLI сервис без встраивания весов в архив | DONE (код сервиса) | `tools/research_nli_server.py` + `research/requirements-nli.txt`; `cross-encoder/nli-deberta-v3-xsmall`; loopback по умолчанию, bounds и token для non-loopback. Реальные pretrained weights/inference в этой среде не прогонялись. |
| Снизить риск частичной поддержки составного утверждения | PARTIAL | Консервативная атомизация; если не все атомы поддержаны, parent claim не получает `support`. Сложные языковые конструкции требуют улучшения на размеченной выборке. |
| Защитить project progress credit от неразрешённого/смешанного NLI | DONE (policy path) | При model-assisted режиме нужны support verdict и минимум две независимые model-scored lineage families; mixed/refute/unknown не получают положительный credit. |
| Добавить regressions для NLI/runtime/service | DONE (mocked) | 20 semantic NLI cases и 3 HTTP service contract tests; отдельно проходятся runtime typecheck, claim evidence, lineage, idempotency и project research gates. Тесты не доказывают качество настоящей модели. |
| Калибровка score, labelled adversarial holdout и реальное качество модели | TODO | Softmax сохраняется как uncalibrated score; нужны label set, language/claim-type slices, threshold tuning без утечки в holdout. |
| UI production build, browser E2E и release durability | TODO/BLOCKED | WorkPass22 не заявляет эти ворота закрытыми. |

**Приёмка WorkPass22:** runtime TypeScript PASS; claim evidence 20; source lineage 8; semantic NLI integration 20 (mocked); NLI service contract 3 (mocked model); project idempotency 5; project research/Core gates PASS. Реальный cross-encoder inference, калибровка и UI build не подтверждены.

---

## WorkPass 21 — source lineage, syndication control и canonical MemoryOS2 dedup (11.10.2026)

| Изменение | Статус | Реальный результат / граница |
|---|---|---|
| Нормализовать канонический URL и исключить tracking query/fragment из document identity | DONE | `ResearchSourceLineage.ts` исключает типовые параметры аналитики, нормализует `www`, hash и порядок query-параметров; meaningful query сохраняется. |
| Обнаруживать exact-copy и осторожные syndicated near-duplicates между доменами | DONE (ограниченный scope) | Exact extracted-content identity и 5-token shingles; near-duplicate допускается только для достаточно длинного текста и высоких порогов перекрытия. Короткая тематическая схожесть не сливает источники. |
| Встроить source lineage в ProjectResearchSession и пересобирать его при restore | DONE | Lineage вычисляется при ingestion, сохраняется в каждой bounded row и пересчитывается из source metadata на восстановлении; добавлен `duplicateLineageCount`. |
| Запретить копиям одной истории проходить EvidenceFirewall как независимым подтверждениям | DONE | Firewall строит связные компоненты `publisher ↔ sourceLineage`; два домена одной синдицированной истории дают одну evidence family, не снимая same-document conflict logic. |
| Не плодить дубли в canonical MemoryOS2 | DONE | Создаётся одна hypothesis note на lineage; дополнительные URL сохраняются как ограниченный `researchMirrorUrls` provenance. Evidence остаётся гипотезой с прежним cap, не фактом. |
| Проверить настоящее сквозное поведение через OrganismCore | DONE | Добавлены 8 lineage cases и реальный Core сценарий: два зеркала не промотируются, третий независимый источник позволяет собрать две lineage families, в памяти остаётся две заметки и сохраняются обе зеркальные ссылки. |
| Полный source genealogy (первоисточник пресс-релиза, цитирующие публикации, лицензированные синдикации) | PARTIAL | Lexical near-duplicate не решает весь граф происхождения; следующая ступень — lineage metadata/feed/canonical URL и размеченный набор false-merge/false-split. |
| Semantic NLI/entailment, atomic claims, независимый temporal holdout | TODO | Не выдавать exact text anchors и source diversity за смысловое доказательство или измеренный прирост памяти. |
| Dependency-complete app install/build, browser/Live2D E2E и RC durability | TODO/BLOCKED | Runtime release line обновлена; frontend production build, clean-room restore/rollback, soak и SBOM остаются открытыми. |

**Приёмка WorkPass21:** runtime TypeScript PASS; claim evidence 20 cases; source lineage 8 cases; project research/Core integration PASS; idempotency/replay 5 scenarios PASS. `npm run audit:workpass21` собирает их в единый runtime/root gate. Полный production build UI этим не подтверждён.

# Список дел — Neuro-Kurisu SUPER (актуальное состояние WorkPass 22; ниже сохранена история предыдущих проходов)

**Каноническая основа:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS21_2026-10-11.zip`  
**Текущая дата прохода:** 2026-10-11  
**Runtime owner:** Neuro-Kurisu 35.44.0 / schema 223  
**Статус:** implementation workpass; это не заявление о полной release readiness.


## WorkPass 20 — implementation update (11.10.2026)

| Изменение | Статус | Фактический результат / граница |
|---|---|---|
| Провести explicit claim и provenance через ActionGateway в ProjectResearchSession | DONE | Пропавшие `independenceKey`, `sourceHost`, `fetchedAt` и `claim` доходят до canonical research session; сессии изолированы хешем claim. |
| Добавить claim-level support/refute/mixed/unknown c цитатой и происхождением | DONE (ограниченный scope) | `ResearchClaimAssessment.ts` хранит точный фрагмент/offsets/URL/document key/content hash/source key/fetch time; exact-text-anchor-only, calibrated probability не заявляется. |
| Соединить claim conflict с canonical MemoryOS2 | DONE | Два независимых прямых текстовых якоря могут стать hypothesis-only evidence; смесь поддержки и опровержения переводит ранее доступные заметки в quarantine. |
| Убрать повторное завершение соседнего шага старым outcome receipt | DONE | Executor v5 коррелирует по executionId/stepId и хранит последние 512 обработанных IDs через restart; повторные/устаревшие receipts не продвигают план. |
| Поднять root/runtime version и lockfile одной линией | DONE | Root `20.0.0-super-final6`, runtime `35.42.0`; новые current-status JSON/MD, weighted scorecard и WorkPass20 gate. |
| Runtime research/idempotency regressions | DONE | 20 claim cases, 5 replay/restart scenarios, 14 external transport cases, research/firewall/persistence, autonomous project lifecycle/recovery и runtime TypeScript — PASS. |
| Настоящий semantic NLI/entailment и калибровка claim confidence | TODO | Exact text anchors не являются семантическим доказательством; нужен NLI/semantic provider + размеченный adversarial holdout. |
| Полноценный app install/build и desktop/mobile browser/Live2D E2E | TODO/BLOCKED | Environment не содержит Vite/vite-client app dependencies; production build не заявляется. |
| Независимый temporal MemoryOS2 holdout и measured uplift | TODO | Нет основания считать качество памяти улучшенным до сравнения с фиксированным holdout/BM25. |
| Clean-room restore/upgrade/rollback, soak, SBOM/provenance release sign-off | TODO | Критические release gates не закрыты. |

## Новые задачи этого прохода — статус

| Задача | Статус | Реальный результат / следующий шаг |
|---|---|---|
| Выборочно перенести отсутствовавшие изменения Pass 1–3, не подменяя актуальное дерево | DONE | Перенесены только совместимые модули, тесты, route/UI wiring и safety helper. |
| Подключить адаптер стратегической памяти к реальному cycle/policy пути | DONE | MemoryOS2 retrieval → evidence-gated advisory → PolicyAuthorityLedger; bias ограничен ±0.03; состояние мигрируется/сохраняется. |
| Добавить проверку переносимости субъекта | DONE | Read-only fidelity evaluator использует существующий PortableSubjectContract; не утверждает поведенческую эквивалентность. |
| Встроить бюджетирование контекста в оба builder-а prompt | DONE | Normal и proposal prompt получают тот же бюджетированный контекст; omission ledger доступен через runtime/API. |
| Замкнуть диагностики API → client → Runtime Atlas | DONE | Три новых диагностики и исправленный sensorium endpoint; linkage-аудит прошёл. |
| Убрать локальный абсолютный путь у NeuroCore V143 benchmark-ов | DONE | `NK_NEUROCORE_V143_OUTPUT_DIR`, project-local default, тесты default/override. |
| Сделать резервирование/восстановление повторно используемым и безопасным | DONE | Общий helper с SHA-256, staging, pre-restore backup, подтверждением и проверкой live lock; 4 теста прошли. |
| Обновить server smoke реальными API-вызовами новых поверхностей | DONE | Проверены HTTP chat completion, subject fidelity, memory strategy, context budget, sensorium route. |
| Проверить сохранение интеграций из HOTFIX_CHAT | DONE | Прошли organism, WILL, Lumina, Hexis, Letta и Conscio targeted tests. |
| Установить отсутствующие app dependencies и выполнить typecheck/build | TODO | Full root typecheck не завершён: отсутствуют `@types/node` и `vite/client`; требуется полноценная установка зависимостей. |
| Выполнить настоящий браузерный E2E на чистом окружении | TODO | Не считать API smoke заменой пользовательского browser run. |
| Выполнить clean-room backup/restore + upgrade/rollback drill | PARTIAL | Безопасность helper проверена тестами; полный эксплуатационный drill ещё не выполнен. |
| Сделать benchmark uplift для Memory 2.0/hybrid retrieval и доказать пользу стратегии | TODO | До benchmark/holdout не расширять влияние на action selection и не объявлять uplift. |
| Провести multi-hour soak и измерить memory growth/resource limits | TODO | Нужны длительные прогоны на целевой среде. |
| Закрыть capability evidence graph для ключевых пользовательских сценариев | PARTIAL | Базовые HTTP/API linkage и несколько end-to-end путей теперь покрыты; нужна полная трасса input → action → outcome → persistence → UI. |
| Release-candidate gate: SBOM, provenance, clean build, E2E, rollback, soak | TODO | Не пройден; никакой release-ready статус не заявляется. |


## Новые задачи этого прохода — WorkPass 5: Agency Execution Seam

| Задача | Статус | Реальный результат / оставшийся шаг |
|---|---|---|
| Создать bounded MotorSchema execution contract | DONE | Версионированная схема шагов, валидация безопасных идентификаторов, prior-step-only bindings, declared outputs, retry/cost limits и policy constraints. |
| Привязать MotorSchema к canonical skill/executor | DONE | `OrganismCore.compileMotorSchema()` передаёт валидированный план в существующий `ProceduralSkillLibrary`; выполнение остаётся на `ActionGateway`. |
| Разделить availability, competence, policy и execution outcome | DONE | Введены отдельные outcome classes, включая `policy-refused` отдельно от `competence-insufficient` и `execution-failed`. |
| Сохранить outcome class в canonical причинной записи | DONE | Обычные tool call, compound steps и project tools передают outcome class в `OutcomeCognitionFabric`; receipt и verification record хранят класс. |
| Проверить schema edges и реальные compound execution | DONE | `motor-schema-agency-contract.mjs` покрывает malformed/unsafe inputs, все семь классов исхода, promotion через канонические evidence gates и bound-output transfer между шагами. |
| Повторно выполнить существующие outcome/skill/memory/portable/context regressions | DONE | big-pass-62/98/99, Adaptive Memory Strategy, Portable Subject Fidelity и Language Context Budget — PASS. |
| Выполнить integration audit и живые smoke | DONE | `audit:integration-workpass`, organism smoke и HTTP server smoke — PASS; API linkage 122 routes/47 Runtime Atlas surfaces, required seams без пропусков. |
| Закрыть полный agency loop `AffordanceField → ActionCompetition → arbiter → outcome → reafference/TemporalCredit` | PARTIAL | MotorSchema→skill→gateway→outcome ledger связан; affordance/competition и вся causal reafference chain — следующий проход. |
| Провести baseline/holdout Memory 2.0 tests и доказать uplift | TODO | Стратегия остаётся bounded/advisory; не расширять влияние до результата controlled benchmark. |
| Runtime TypeScript semantic typecheck | DONE | `npm --prefix runtime/neuro-kurisu run typecheck` → `TYPECHECK=PASS mode=tsc`; после замены `Buffer` на bounded UTF-8 helper собственный runtime type error устранён. |
| Root/app TypeScript typecheck и clean React/Vite build | TODO | Root check блокируется отсутствующими app definitions `@types/node` и `vite/client`; production build остаётся неподтверждённым. |
| Browser E2E: UI, mobile layout, Live2D interaction | TODO | HTTP smoke и static route linkage не закрывают browser E2E. |
| Clean-room upgrade/rollback, restore drill, multi-hour soak | TODO | Backup helper unit tests прошли, эксплуатационный drill и soak остаются открытыми. |
| Сформировать текущую взвешенную шкалу работ | DONE | Текущий оценочный progress **57.0%**; это взвешенный roadmap показатель, не release readiness. Формула и все веса находятся в `docs/PROJECT_PROGRESS_SCORECARD_2026-10-09.json`. |

## WorkPass 5 — подтверждённые проверки

- `npm run audit:integration-workpass` — PASS.
- `npm run test:smoke` (в runtime) — PASS.
- `node --experimental-strip-types tests/server-smoke.mjs` (из runtime) — PASS; живой HTTP chat и интеграционные endpoints.
- `node --experimental-strip-types tests/motor-schema-agency-contract.mjs` — PASS; outcome classification переживает projection в canonical verification ledger.
- Outcome verification, compound device agency, skill compiler, adaptive memory strategy, portable subject boundary и language context budget — PASS.
- `audit:server-imports` — 10 imports checked, 0 missing; `audit:ui-api-linkage` — 122 client routes, 47 Runtime Atlas surfaces, missing required seams = 0.
- Runtime semantic typecheck — PASS. Root/app typecheck/build, browser E2E, clean-room rollback/restore drill, multi-hour soak и benchmark holdout — не подтверждены/не пройдены, остаются в TODO.

## Единая процентная шкала — WorkPass 5

Веса фиксированы на уровне workstreams и суммируются до 100; completion area — оценка по реальным deliverables и gates, не по числу файлов.

| Направление | Вес | Выполнено | Баллы |
|---|---:|---:|---:|
| A. Каноническая основа и single-owner архитектура | 15% | 100% | 15.0 |
| B. Runtime/API/UI linkage и smoke | 15% | 90% | 13.5 |
| C. Memory 2.0 + benchmark evidence | 15% | 40% | 6.0 |
| D. Agency/action/outcome/reafference | 20% | 45% | 9.0 |
| E. Portable subject/social dossier | 10% | 55% | 5.5 |
| F. Transport/SDK/replay | 10% | 20% | 2.0 |
| G. Research promotion/holdout | 5% | 30% | 1.5 |
| H. Release/build/E2E/rollback/soak/SBOM | 10% | 45% | 4.5 |
| **Итого по весам** | **100%** |  | **57.0%** |

WorkPass 5 поднял agency workstream D с 25% до 45%, то есть на **4.0 процентных пункта** общего взвешенного результата (53.0% → 57.0%). Это не значит, что весь функционал проекта выполнен на 57%; открытые release gates выше остаются обязательными.

---

## Проверки, выполненные в WorkPass 4

- `npm run audit:quick` — PASS (assets, architecture, source hygiene, release contract, integrity, syntax).
- `npm run audit:integration-workpass` — PASS.
- `node --experimental-strip-types tests/server-smoke.mjs` — PASS, включая живой запрос `/api/organism/chat`.
- `npm run test:smoke` — PASS.
- WILL integration 9/9 и WILL surfaces 3/3 — PASS.
- Lumina adaptation 3/3 — PASS; Hexis adaptation и server smoke — PASS.
- Letta governance — PASS.
- Conscio adaptation, UI wiring (18 методов, 0 отсутствующих/неиспользуемых) и server smoke — PASS.
- Backup/restore helper — 4 tests PASS; real root CLI round-trip PASS (raw bytes preserved; restore without confirmation rejected); NeuroCore V143 portable output path — 2 tests PASS.
- Full root typecheck — BLOCKED из-за отсутствующих `@types/node` и `vite/client`; полный React/Vite build и browser E2E не подтверждены.

> **Важно о счётчиках ниже:** приведённый далее исторический список и его агрегатные числа относятся к предыдущему workpass. Они не пересчитаны автоматически на другое дерево и не складываются с новыми задачами выше. При следующем этапе следует пересчитать единую таблицу по текущему canonical tree, а не выдавать смешанный процент готовности.

---

# Список дел — Neuro-Kurisu SUPER

**Текущая версия:** 2.6.0-super  
**Дата:** 2026-10-06  
**Всего пунктов:** 350  
**DONE:** 179  
**PARTIAL:** 124  
**TODO:** 47  
**Полностью выполнено:** 51.1%

> Статус `DONE` означает, что пункт реально закрыт в текущем дереве по коду/интеграции или уже доказан существующей реализацией. `PARTIAL` — часть механизма существует, но до release-gate ещё не доведено. `TODO` — полноценной реализации ещё нет.

## Этап 0 — целевое состояние

**Этап:** 12 DONE · 0 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 1 | Зафиксировать Neuro-Kurisu 35.40 как canonical owner | DONE |
| 2 | Зафиксировать schema/version contract | DONE |
| 3 | Зафиксировать ownership каждого системного домена | DONE |
| 4 | Разделить production / research / legacy / provenance | DONE |
| 5 | Зафиксировать API versioning policy | DONE |
| 6 | Зафиксировать конфигурационные профили dev/research/staging/release | DONE |
| 7 | Зафиксировать обязательные runtime invariants | DONE |
| 8 | Зафиксировать CPU/RAM/storage budgets | DONE |
| 9 | Зафиксировать memory-growth policy | DONE |
| 10 | Зафиксировать online-learning policy | DONE |
| 11 | Зафиксировать rollback policy | DONE |
| 12 | Зафиксировать критерии 100% release-ready | DONE |

## Этап 1 — structural cleanup

**Этап:** 7 DONE · 12 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 13 | Разделить runtime на core/systems/cognition/memory/world/language/embodiment/persistence/research | PARTIAL |
| 14 | Привести каталоги к единой схеме именования | PARTIAL |
| 15 | Устранить неоднозначные basename collision patterns | DONE |
| 16 | Определить единственный canonical смысл BrainHub/AceMemory/ModuleManager/types | PARTIAL |
| 17 | Переименовать исторические реализации по роли | PARTIAL |
| 18 | Сократить deep-relative imports | PARTIAL |
| 19 | Ввести полезные barrel/index exports | PARTIAL |
| 20 | Удалить неиспользуемые exports | PARTIAL |
| 21 | Убрать dead code | PARTIAL |
| 22 | Проверить динамические imports | PARTIAL |
| 23 | Проверить filesystem references | PARTIAL |
| 24 | Проверить JSON/config references | PARTIAL |
| 25 | Проверить asset paths | DONE |
| 26 | Проверить scripts → source targets | PARTIAL |
| 27 | Проверить docs → actual paths | DONE |
| 28 | Проверить manifests → actual files | DONE |
| 29 | Проверить package scripts → actual commands | DONE |
| 30 | Сделать единый CODE-MAP | DONE |
| 31 | Сделать machine-readable ownership graph | DONE |

## Этап 2 — integration fabric

**Этап:** 17 DONE · 9 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 32 | Связать OrganismSystemFabric с единой event bus | PARTIAL |
| 33 | Ввести canonical event envelope | DONE |
| 34 | Ввести eventId | DONE |
| 35 | Ввести parentEventId | DONE |
| 36 | Ввести causalOrigin | PARTIAL |
| 37 | Ввести sourceSubsystem | DONE |
| 38 | Ввести confidence | DONE |
| 39 | Ввести timestamp/monotonic ordering | DONE |
| 40 | Ввести correlation IDs | PARTIAL |
| 41 | Протянуть lineage observation → action | DONE |
| 42 | Протянуть lineage action → outcome | DONE |
| 43 | Связать outcome → learning update | DONE |
| 44 | Связать learning update → memory update | DONE |
| 45 | Связать retrieval → planning | DONE |
| 46 | Связать planning → action | DONE |
| 47 | Сделать causal chain видимой в diagnostics | DONE |
| 48 | Добавить subsystem dependency state | DONE |
| 49 | Добавить degraded-mode state | DONE |
| 50 | Добавить subsystem restartability | PARTIAL |
| 51 | Добавить circuit breakers | PARTIAL |
| 52 | Добавить backpressure | PARTIAL |
| 53 | Добавить event queue limits | DONE |
| 54 | Добавить duplicate-event handling | PARTIAL |
| 55 | Добавить idempotency | PARTIAL |
| 56 | Добавить timeout policy | DONE |
| 57 | Добавить cancellation propagation | PARTIAL |

## Этап 3 — memory + identity + continuity

**Этап:** 20 DONE · 4 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 58 | Единая иерархия working/episodic/semantic/causal/self memory | DONE |
| 59 | Убрать остаточные parallel memory owners | DONE |
| 60 | Canonical memory IDs | DONE |
| 61 | Memory provenance | DONE |
| 62 | Salience | DONE |
| 63 | Confidence | DONE |
| 64 | Decay | DONE |
| 65 | Reinforcement | DONE |
| 66 | Contradiction tracking | PARTIAL |
| 67 | Source reliability | DONE |
| 68 | Разделить observed/inferred/learned | DONE |
| 69 | Связать memory с causal graph | DONE |
| 70 | Связать memory с goals | DONE |
| 71 | Связать memory с identity state | DONE |
| 72 | Self-model persistence | DONE |
| 73 | Session continuity | DONE |
| 74 | Restart continuity | DONE |
| 75 | Memory compaction | DONE |
| 76 | Archival tier | DONE |
| 77 | Bounded memory growth | DONE |
| 78 | Memory migration | PARTIAL |
| 79 | Corruption recovery | PARTIAL |
| 80 | Snapshot versioning | DONE |
| 81 | Selective forgetting/retention policy | PARTIAL |

## Этап 4 — cognition pipeline

**Этап:** 20 DONE · 0 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 82 | Объединить perception/observation pipeline | DONE |
| 83 | Развести raw и interpreted observation | DONE |
| 84 | Связать semantic-world state с cognition | DONE |
| 85 | Связать goals с planning | DONE |
| 86 | Связать planning с action candidates | DONE |
| 87 | Связать action candidates с risk estimation | DONE |
| 88 | Связать risk с action policy | DONE |
| 89 | Связать prediction с decision | DONE |
| 90 | Связать prediction error с learning | DONE |
| 91 | Связать uncertainty с exploration | DONE |
| 92 | Связать surprise с memory salience | DONE |
| 93 | Связать novelty с exploration budget | DONE |
| 94 | Связать reward с long-term policy update | DONE |
| 95 | Ввести confidence-aware decision | DONE |
| 96 | Ввести fallback cognition mode | DONE |
| 97 | Ввести deterministic emergency mode | DONE |
| 98 | Ввести cognition tracing | DONE |
| 99 | Ввести per-cycle causal summary | DONE |
| 100 | Ввести decision explanation object | DONE |
| 101 | Ввести action provenance | DONE |

## Этап 5 — language intelligence

**Этап:** 16 DONE · 8 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 102 | Единый provider interface | DONE |
| 103 | Provider health | DONE |
| 104 | Provider latency | DONE |
| 105 | Provider token/cost budget | DONE |
| 106 | Provider context budget | PARTIAL |
| 107 | Automatic fallback | DONE |
| 108 | Provider circuit breaker | DONE |
| 109 | Retry policy | DONE |
| 110 | Exponential backoff | DONE |
| 111 | Prompt contract | PARTIAL |
| 112 | Context assembly pipeline | DONE |
| 113 | Memory retrieval перед generation | DONE |
| 114 | Goal context перед generation | DONE |
| 115 | World context перед generation | DONE |
| 116 | Identity context перед generation | DONE |
| 117 | Tool context перед generation | DONE |
| 118 | Evidence context перед generation | DONE |
| 119 | Post-generation validation | PARTIAL |
| 120 | Hallucination confidence tagging | PARTIAL |
| 121 | Structured answer mode | PARTIAL |
| 122 | Free-form mode | PARTIAL |
| 123 | Offline mode | PARTIAL |
| 124 | Provider sandbox | DONE |
| 125 | Task-based provider selection | PARTIAL |

## Этап 6 — search/research/evidence

**Этап:** 13 DONE · 8 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 126 | Единый research request object | PARTIAL |
| 127 | Search permission enforcement | DONE |
| 128 | Search provenance | DONE |
| 129 | Search timestamp | DONE |
| 130 | Search source ranking | PARTIAL |
| 131 | Domain allow/deny rules | DONE |
| 132 | Evidence extraction | DONE |
| 133 | Evidence normalization | PARTIAL |
| 134 | Evidence confidence | DONE |
| 135 | Conflicting-source detection | PARTIAL |
| 136 | Evidence firewall | DONE |
| 137 | Evidence → memory только через policy | DONE |
| 138 | Evidence → causal graph через policy | DONE |
| 139 | Research result → hypothesis | DONE |
| 140 | Hypothesis → experiment | DONE |
| 141 | Experiment → observation | DONE |
| 142 | Observation → evidence | DONE |
| 143 | Evidence → promotion candidate | PARTIAL |
| 144 | Promotion → holdout | PARTIAL |
| 145 | Holdout → regression | PARTIAL |
| 146 | Regression → promotion decision | PARTIAL |

## Этап 7 — research promotion

**Этап:** 1 DONE · 18 PARTIAL · 5 TODO

| № | Задача | Статус |
|---:|---|---|
| 147 | Единый research candidate schema | PARTIAL |
| 148 | Candidate owner | PARTIAL |
| 149 | Capability field | PARTIAL |
| 150 | Expected benefit | PARTIAL |
| 151 | Failure mode | PARTIAL |
| 152 | Benchmark definition | PARTIAL |
| 153 | Holdout definition | PARTIAL |
| 154 | Regression definition | PARTIAL |
| 155 | Promotion score | PARTIAL |
| 156 | NOMEGA consolidation queue из 119 кандидатов | PARTIAL |
| 157 | Не делать bulk-copy исторических модулей | DONE |
| 158 | Для каждого модуля выбрать promote/adapt/archive/reject | PARTIAL |
| 159 | NeuroCore benchmark без hardcoded path | PARTIAL |
| 160 | Multi-seed benchmark | TODO |
| 161 | Long-horizon benchmark | TODO |
| 162 | Memory benchmark | TODO |
| 163 | Continual-learning benchmark | TODO |
| 164 | DeepCode rssm_prior audit | PARTIAL |
| 165 | DeepCode EB query gradient audit | PARTIAL |
| 166 | DeepCode discrete option selection audit | PARTIAL |
| 167 | Controlled ablation tests | TODO |
| 168 | Baseline vs candidate comparison | PARTIAL |
| 169 | Evidence-gated promotion | PARTIAL |
| 170 | После promotion перепривязать capability к canonical owner | PARTIAL |

## Этап 8 — learning system

**Этап:** 13 DONE · 9 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 171 | Единый learning scheduler | DONE |
| 172 | Единый optimizer policy | PARTIAL |
| 173 | Learning budget | DONE |
| 174 | Gradient budget | PARTIAL |
| 175 | Update frequency control | DONE |
| 176 | Online/offline learning separation | DONE |
| 177 | Experience replay policy | DONE |
| 178 | Priority sampling | PARTIAL |
| 179 | Anti-collapse checks | DONE |
| 180 | Catastrophic forgetting checks | DONE |
| 181 | Stability monitor | DONE |
| 182 | Learning rollback | DONE |
| 183 | Checkpointing | DONE |
| 184 | Model versioning | PARTIAL |
| 185 | Dataset/version provenance | PARTIAL |
| 186 | Seed tracking | PARTIAL |
| 187 | Benchmark manifest | DONE |
| 188 | Experiment registry | DONE |
| 189 | Experiment reproducibility | PARTIAL |
| 190 | Drift detector | DONE |
| 191 | Regression against historical models | PARTIAL |
| 192 | Promotion only after stability gate | PARTIAL |

## Этап 9 — UI/product

**Этап:** 7 DONE · 4 PARTIAL · 15 TODO

| № | Задача | Статус |
|---:|---|---|
| 193 | Восстановить UI dependencies в чистой среде | TODO |
| 194 | Полный npm ci | TODO |
| 195 | Полный TypeScript UI build | TODO |
| 196 | Полный Vite build | TODO |
| 197 | UI tests | TODO |
| 198 | Runtime/API contract tests | PARTIAL |
| 199 | Browser E2E | TODO |
| 200 | Chat E2E | TODO |
| 201 | Search E2E | TODO |
| 202 | Memory continuity E2E | TODO |
| 203 | Live2D E2E | TODO |
| 204 | Sprite fallback E2E | TODO |
| 205 | Mobile layout | TODO |
| 206 | Desktop layout | TODO |
| 207 | Error-state UI | DONE |
| 208 | Offline UI | PARTIAL |
| 209 | Degraded-provider UI | DONE |
| 210 | Runtime-health UI | DONE |
| 211 | Integration graph UI | DONE |
| 212 | Research status UI | DONE |
| 213 | Learning status UI | DONE |
| 214 | Persistence status UI | DONE |
| 215 | Accessibility pass | TODO |
| 216 | Keyboard navigation | PARTIAL |
| 217 | Screen-reader semantics | PARTIAL |
| 218 | UI performance budget | TODO |

## Этап 10 — observability

**Этап:** 18 DONE · 4 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 219 | Structured logs | PARTIAL |
| 220 | Request tracing | PARTIAL |
| 221 | Runtime cycle tracing | DONE |
| 222 | Cognitive tracing | DONE |
| 223 | Memory tracing | DONE |
| 224 | Provider tracing | DONE |
| 225 | Research tracing | DONE |
| 226 | Persistent journal telemetry | DONE |
| 227 | CPU metrics | DONE |
| 228 | RAM metrics | DONE |
| 229 | Storage metrics | DONE |
| 230 | Event queue metrics | DONE |
| 231 | Provider latency metrics | DONE |
| 232 | Error-rate metrics | PARTIAL |
| 233 | Learning-throughput metrics | PARTIAL |
| 234 | Memory-growth metrics | DONE |
| 235 | Health dashboard | DONE |
| 236 | Liveness endpoint | DONE |
| 237 | Readiness endpoint | DONE |
| 238 | Shutdown status | DONE |
| 239 | Startup diagnostics | DONE |
| 240 | Crash recovery state | DONE |

## Этап 11 — security/boundaries

**Этап:** 6 DONE · 14 PARTIAL · 0 TODO

| № | Задача | Статус |
|---:|---|---|
| 241 | Проверить все filesystem writes | PARTIAL |
| 242 | Path traversal | PARTIAL |
| 243 | Subprocess boundaries | DONE |
| 244 | External URLs | DONE |
| 245 | Search policy | DONE |
| 246 | Secret handling | PARTIAL |
| 247 | Environment variable leaks | PARTIAL |
| 248 | Logs на secrets | PARTIAL |
| 249 | Research write isolation | DONE |
| 250 | UI → runtime authorization | PARTIAL |
| 251 | Tool capability boundaries | DONE |
| 252 | Provider credentials | PARTIAL |
| 253 | Malformed JSON/API payloads | PARTIAL |
| 254 | Oversized payloads | PARTIAL |
| 255 | Rate limits | PARTIAL |
| 256 | Timeout limits | PARTIAL |
| 257 | Memory limits | PARTIAL |
| 258 | Disk limits | PARTIAL |
| 259 | Safe-mode startup | DONE |
| 260 | Recovery after corrupted state | PARTIAL |

## Этап 12 — packaging/deployment

**Этап:** 7 DONE · 10 PARTIAL · 3 TODO

| № | Задача | Статус |
|---:|---|---|
| 261 | One-command install | PARTIAL |
| 262 | One-command dev start | DONE |
| 263 | One-command production start | PARTIAL |
| 264 | One-command health check | DONE |
| 265 | One-command backup | PARTIAL |
| 266 | One-command restore | PARTIAL |
| 267 | One-command migration | PARTIAL |
| 268 | Version migration scripts | TODO |
| 269 | Config migration scripts | TODO |
| 270 | Schema migration scripts | TODO |
| 271 | Asset verification | DONE |
| 272 | Archive manifest | DONE |
| 273 | SHA-256 | DONE |
| 274 | Reproducible package build | PARTIAL |
| 275 | Clean package without caches | DONE |
| 276 | Cross-platform path handling | PARTIAL |
| 277 | Node version pin | PARTIAL |
| 278 | Python version pin | PARTIAL |
| 279 | Dependency lock verification | DONE |
| 280 | Offline install documentation | PARTIAL |

## Этап 13 — release candidate

**Этап:** 7 DONE · 4 PARTIAL · 11 TODO

| № | Задача | Статус |
|---:|---|---|
| 281 | Build RC-1 | TODO |
| 282 | Install RC-1 в чистой среде | TODO |
| 283 | Start from zero state | TODO |
| 284 | Start from restored state | DONE |
| 285 | Run chat | DONE |
| 286 | Run memory loop | DONE |
| 287 | Run learning loop | PARTIAL |
| 288 | Run planning loop | DONE |
| 289 | Run search | DONE |
| 290 | Run research pipeline | PARTIAL |
| 291 | Restart | DONE |
| 292 | Restore | DONE |
| 293 | Upgrade from previous SUPER version | TODO |
| 294 | Rollback to previous version | TODO |
| 295 | Long-duration soak | TODO |
| 296 | Memory growth soak | TODO |
| 297 | Provider failure soak | TODO |
| 298 | Filesystem failure simulation | TODO |
| 299 | Network loss simulation | TODO |
| 300 | Subprocess failure simulation | PARTIAL |
| 301 | Corrupted-state recovery | PARTIAL |
| 302 | UI/browser session recovery | TODO |

## Этап 14 — final release gate

**Этап:** 15 DONE · 20 PARTIAL · 13 TODO

| № | Задача | Статус |
|---:|---|---|
| 303 | Все canonical owners уникальны | DONE |
| 304 | Нет второго writable brain | DONE |
| 305 | Нет второго writable memory owner | DONE |
| 306 | Нет второго identity owner | DONE |
| 307 | Нет незадокументированного state | PARTIAL |
| 308 | Нет dangling imports | DONE |
| 309 | Нет orphan critical files | PARTIAL |
| 310 | Нет orphan critical APIs | PARTIAL |
| 311 | Нет broken asset references | DONE |
| 312 | Нет broken configuration references | PARTIAL |
| 313 | Нет broken migration paths | PARTIAL |
| 314 | Нет blocked critical subsystem | PARTIAL |
| 315 | Нет critical security issue | PARTIAL |
| 316 | Нет critical persistence issue | PARTIAL |
| 317 | Нет critical recovery issue | PARTIAL |
| 318 | Нет critical UI issue | PARTIAL |
| 319 | Нет critical performance regression | PARTIAL |
| 320 | Все research branches имеют promotion state | DONE |
| 321 | Все legacy branches имеют immutable provenance | DONE |
| 322 | Все manifests соответствуют фактическому дереву | DONE |
| 323 | Все версии синхронизированы | DONE |
| 324 | CHANGELOG синхронизирован | PARTIAL |
| 325 | README синхронизирован | DONE |
| 326 | Deployment docs синхронизированы | PARTIAL |
| 327 | Recovery docs синхронизированы | PARTIAL |
| 328 | Final build в чистой среде | TODO |
| 329 | Final archive проверен | DONE |
| 330 | Final hash записан | DONE |
| 331 | RC → release diff сохранён | PARTIAL |
| 332 | Release manifest зафиксирован | PARTIAL |
| 333 | Final smoke | TODO |
| 334 | Final browser E2E | TODO |
| 335 | Final persistence E2E | PARTIAL |
| 336 | Final research E2E | PARTIAL |
| 337 | Final provider-fallback E2E | PARTIAL |
| 338 | Long-running stability pass | TODO |
| 339 | Release report | DONE |
| 340 | Exact source tree fixed | PARTIAL |
| 341 | Immutable release archive | DONE |
| 342 | Rollback archive | TODO |
| 343 | Production config freeze | TODO |
| 344 | Dependency SBOM/license inventory | TODO |
| 345 | Backup/restore drill signed off | TODO |
| 346 | Operational alert thresholds configured | TODO |
| 347 | Operator runbook signed off | TODO |
| 348 | Release artifact provenance manifest | TODO |
| 349 | Final release version/tag lock | TODO |
| 350 | 100% RELEASE READY | TODO |

## Текущий приоритет

Следующий кодовый блок: глубокая consolidation/credit/learning-интеграция с дальнейшим закрытием research-promotion и release packaging.

## Состояние release-gate

100% пока **не достигнуто**. Главные объективные хвосты: чистая UI build-среда, полноценный browser E2E, research promotion gates, clean-room RC, security/recovery final gates и long-running soak.


---

## Обновление рабочего прохода — 2026-10-09

**Формат:** append-only. Исторические счётчики и статусы выше относятся к срезу 2026-10-06 и намеренно не пересчитываются задним числом. Новые задачи ниже относятся только к совместимой восстановленной сборке; это не подтверждение полного паритета с недоступным ZIP от 2026-10-09.

| Задача | Статус | Результат / ограничение |
|---|---|---|
| Восстановить список дел внутрь корня проекта | DONE | Сохранена предыдущая нумерация и добавлено это приложение. |
| Проверить и закрепить владельца research API без второго runtime-owner | DONE | `ResearchDock` → Vite proxy/gateway → `research/research_bridge.py`; добавлен service-aware аудит handler-ов и обоих forwarding-путей. Дублирующие runtime-маршруты не создаются. |
| Сохранить управляемое исполнение research-проб через единственный bridge | DONE | Пользовательский клик запускает существующую пробу в `research/research_bridge.py`; runtime не создаёт второго исполнителя и не продвигает кандидаты автоматически. |
| Связать identity/title/description интерфейса с единым metadata manifest | DONE | `app/src/routes/__root.tsx` использует `app/src/lib/og/site.json`. |
| Добавить аудит отсутствующих относительных импортов серверного entrypoint | DONE | Новый `audit:server-imports` проверяет разрешимость импортов `server.mjs`. |
| Добавить автоматическую проверку маршрутов UI API против server handlers | DONE | Новый `audit:ui-api-linkage` покрывает все объявленные API-вызовы клиента. |
| Ограничить длительность HTTP smoke-запросов | DONE | Все вызовы имеют timeout; readiness polling имеет короткий предел. |
| Закрепить путь пользовательского чата прямым HTTP regression-тестом | DONE | Server smoke проверяет ответ `/api/organism/chat` и непустой language output. |
| Полностью восстановить UI dependencies и выполнить Vite/browser E2E | TODO | В исходной среде отсутствуют `app/node_modules`; это остаётся внешним release-gate. |
| Перенести интеграционный патч 2026-10-08/09 без несовместимости | TODO | Полный source ZIP от 2026-10-09 отсутствует в библиотеке; доступный патч ссылается на отсутствующие модули/методы и намеренно не наложен. Требуется исходный канонический архив/дерево v20. |
| Выполнить clean-room запуск и soak на целевом устройстве | TODO | Не заявляется как пройденный этой сборкой. |
| Реализовать backup/restore organism state с SHA-256 и pre-restore rollback | DONE | `tools/super-backup.mjs`, `tools/super-restore.mjs`, `tools/lib/state-backup.mjs`; восстановление запрещено при runtime lock и проверяет целостность до записи. |
| Проверить восстановление state на временном окружении | DONE | Четыре регрессионных сценария проверяют двоичные/JSON bytes, SHA-256, защиту от повреждённого бэкапа и отказ при наличии runtime lock. |

### Прозрачность происхождения

Эта сборка создана на основе последнего доступного полного ZIP от 2026-10-06. В библиотеке найдена SHA-256 sidecar-файл ожидаемого архива от 2026-10-09, но сам ZIP не найден. Поэтому данная сборка является совместимым workpass поверх доступной полной базы, а не точной копией недоступного latest tree.


### Дополнение по происхождению и упаковке — 2026-10-09

| Задача | Статус | Результат |
|---|---|---|
| Сохранить исторический manifest 2026-10-08 отдельно от текущей версии | DONE | `docs/analysis/WORKPASS_MANIFEST_2026-10-08_HISTORICAL.json`, явно обозначен как исторический |
| Сохранить несовместимый patch v20 и checksum отсутствующего ZIP без автоматического применения | DONE | `legacy/input-archives/patches/` и `legacy/input-archives/provenance/`; инструкции и причина блокировки записаны рядом |
| Добавить актуальный checksum-manifest совместимой сборки | DONE | `WORKPASS_MANIFEST_2026-10-09.json` фиксирует source baseline, хеши изменений и реальные gate-статусы |
| Сохранить два больших отчёта, сравнительный audit и реализационный pass для продолжения из следующего чата | DONE | Источники сохранены без переписывания в `docs/analysis/` |

### Закрытие интеграционных задач — Runtime Atlas — 2026-10-09

| Задача | Статус | Результат |
|---|---|---|
| Добавить проверяемый Runtime Atlas на главную страницу | DONE | В `app/src/components/RuntimeAtlas.tsx` добавлены 44 поисковые read-only поверхности, каждая связана с клиентским API и существующим server GET handler. |
| Добавить реальную Integration Console без статусов-заглушек | DONE | `app/src/components/IntegrationConsole.tsx` считывает состояние runtime, UI snapshot, avatar/embodiment и research bridge; ошибки отображаются как недоступность. |
| Замкнуть всю цепочку Runtime Atlas → API client → canonical server | DONE | Contract test 2/2 PASS; service-aware audit: 49 routes, 47 runtime-owned + 2 research-bridge-owned, missing=0. |
| Восстановить полноценную HexisControlConsole с реальными write-endpoints | TODO | В доступной полной базе нет подтверждённого набора Hexis control endpoints и нет complete parent tree для console; не заменять реальный контроль фиктивными переключателями. |
| Сверить совместимую сборку с каноническим ZIP от 2026-10-09 | TODO | Sidecar существует, но сам ZIP пока недоступен для материализации. |


### Дополнение — Adaptive Memory Follow-on WorkPass — 2026-10-09

Исторические счётчики сверху оставлены без ретроспективного пересчёта. Таблица относится только к фактически изменённому и проверенному рабочему дереву.

| Задача | Статус | Результат / граница |
|---|---|---|
| Добавить bounded adaptive-memory strategy adapter к canonical policy | DONE | Новый `AdaptiveMemoryStrategyReadout` читает явно помеченные strategy memories из `MemoryOS2`; influence не превышает ±0.03 на действие. |
| Сохранить single-owner архитектуру памяти и policy | DONE | `MemoryOS2` остаётся memory owner, `PolicyAuthorityLedger` — policy owner; readout не создаёт собственную память и не исполняет действия. |
| Привязать обучение стратегии к проверенному внешнему outcome | DONE | Самоотчёт не принимается; требуется verified result и independent project-evidence signal. |
| Генерировать strategy tags только по устойчивому проверенному паттерну | DONE | Canonical causal consolidation помечает паттерн только при ≥3 state-grounded external samples, ≥60% action agreement, mean reward ≥0.65, causal strength ≥0.55 и learning quality ≥0.65. Обычные runtime/replay samples не продвигаются автоматически. |
| Добавить persistence/migration-safe state readout | DONE | State включён в persisted organism state; записи ограничены 192, receipts — 64; добавлен snapshot/restore regression. |
| Вывести диагностику memory strategy через API/UI | DONE | Добавлен `GET /api/organism/memory-strategy`, frontend client method и 45-я read-only поверхность Runtime Atlas. |
| Включить новый capability в стандартную проверку | DONE | `test:adaptive-memory-strategy` подключён к runtime compatibility audit; серверный smoke проверяет ownership contract. |
| Устранить жёсткие локальные пути в NeuroCore V143 benchmark launchers | DONE | Выделен `benchmark_paths.py`; добавлены CLI и environment overrides с project-local default. |
| Проверить портативность путей V143 | DONE | 5 unit tests PASS; Python compile PASS. Само длительное исследовательское выполнение отдельно не заявляется. |
| Повторно проверить server imports и UI/API linkage после новой поверхности | DONE | 7 server imports; 50 API routes (48 runtime + 2 research bridge), 45 Atlas surfaces; missing=0. |
| Полная UI dependency установка, React/Vite build и browser E2E | TODO | В этой среде `app/node_modules`/`vite/client` отсутствует; целевые E2E на desktop/mobile/Live2D не заявляются. |
| Выполнить полные PyTorch DeepCode и NeuroCore V143 workloads, multi-seed/holdout | TODO | Этот пакет проверил path contracts и unit tests, но не запускал дорогие модельные эксперименты. |
| Сверить со средним/последним полным архивом 8–9 октября | TODO | В библиотеке только checksum sidecars, полные ZIP отсутствуют; текущая база — последний материализуемый полный архив от 6 октября + совместимые изменения workpass. |



### Дополнение — Subject Fidelity + Context Budget WorkPass 3 — 2026-10-09

Исторические количества DONE/PARTIAL/TODO наверху оставлены без пересчёта. Статусы ниже относятся только к изменениям этой итерации.

| Задача | Статус | Результат / граница |
|---|---|---|
| Добавить fidelity evaluator для portable subject snapshot | DONE | `PortableSubjectFidelity.ts` проверяет SHA-256, переносимые секции, subject identity и импорт projection; не объявляется полной поведенческой эквивалентностью. |
| Сохранить host-owned embodiment/capability state при subject round-trip | DONE | Regression подтверждает сохранение полей host boundary; повреждённый checksum даёт `insufficient`. |
| Подключить fidelity diagnostic к canonical runtime/API/UI | DONE | `OrganismCore.portableSubjectFidelityDiagnostics()` → `GET /api/organism/subject-fidelity` → app API client → Runtime Atlas. |
| Добавить per-request ContextBudgetLedger | DONE | Учёт included/truncated/omitted dynamic sections, reason, sizes, SHA-256 digest и optional source reference; токены являются оценкой по символам. |
| Включить ledger в настоящий chat/prompt path | DONE | Normal/proposal prompt builders создают отчёт; user-message проходит через canonical prompt builder, endpoint показывает отчёт последнего запроса. |
| Подключить контекстную диагностику к API/UI | DONE | `GET /api/organism/context-budget`, shared client method и Runtime Atlas; поверхность read-only. |
| Добавить fidelity/context unit + HTTP regressions в compatibility audit | DONE | Round-trip/tamper, budget bounds/omissions и реальный chat-path ledger проверены штатной командой. |
| Обновить API/Atlas wiring | DONE | 52 routes: 50 runtime + 2 Python research bridge; 47 real Atlas surfaces; missing handlers=0. |
| Выполнить расширенный быстрый аудит | DONE | `audit:quick` PASS; architecture missing=0/cycles=0/legacyLeakage=0; hygiene errors=0; backup/restore 4/4; V143 path tests 5/5. |
| Полный React/Vite clean build, browser E2E, Live2D interaction | TODO | Не выполнены: отсутствуют UI dependencies в рабочем окружении. |
| Полные DeepCode/NeuroCore workloads, multi-seed/holdout | TODO | Path contracts проверены, длительные model/research experiments не выполнялись в этом проходе. |
| Сверить с точным HOTFIX_CHAT ZIP от 2026-10-09 | TODO | В библиотеке обнаружен только его `.sha256` sidecar; необходимы байты ZIP или полное дерево. |
| Clean-room upgrade/rollback и long-duration soak | TODO | Не заявляются как пройденные. |


### Дополнение — WorkPass 6: agency evidence и reafference — 2026-10-09

Исторические счётчики выше не пересчитываются. Этот блок сообщает только статус задач, реализованных и проверенных поверх WorkPass 5. WorkPass 5 основан на каноническом HOTFIX_CHAT v20 от 2026-10-09 через последовательность совместимых интеграций; более старые архивы использованы как источники отдельных механизмов, а не как замена текущего дерева.

| Задача | Статус | Результат / ограничение |
|---|---|---|
| Адаптировать WILL affordance semantics к существующему candidate set | DONE | `AffordanceField.ts` ограничивает поле attention budget и фиксирует selected-vs-alternative margin; `affectsSelection=false`, селектор остаётся в `OrganismCore`. |
| Сохранить agency evidence в canonical trace и при рестарте | DONE | Новый regression проверяет `snapshot → state migration → restart`; след evidence сохраняется и остаётся read-only объяснением выбора. |
| Замкнуть external reafference на точное решение | DONE | `ReafferenceEvidenceCodec.ts` требует explicit `decisionId`, pending canonical decision и независимый внешний source seam; `actionRef` не используется вместо decision ID. |
| Подключить задержанную обратную связь к текущему temporal-credit/policy owner | DONE | Учитываются только delayed causal assignments с достаточной уверенностью и independence; новых owners не добавлено. |
| Исправить адресное разрешение temporal credit | DONE | `decisionId` теперь ограничивает выбор ровно одной записью; соседние pending решения не получают случайный credit. |
| Исправить directional strength противоречий | DONE | Явные same-field conflicts используют directed contradiction strength; двусмысленный текст не становится подтверждённым конфликтом. |
| Добавить регрессии агентского и внешнего наблюдаемого контура | DONE | 5 новых тестов проходят: affordance, exact temporal targeting, external contradiction, evidence codec, core integration + persistence/restart. |
| Прогнать сохранённые интеграции WILL/Lumina/Hexis/Letta/Conscio | DONE | Runtime typecheck PASS; server smoke PASS; WILL 9/9, surfaces 3/3, Lumina 3/3, Hexis adapter + server smoke PASS, Letta PASS, Conscio adapter + server smoke PASS. |
| Полный root/app build и desktop/mobile/Live2D browser E2E | TODO | Runtime typecheck не подменяет полный UI dependency installation и браузерный прогон; эти gates остаются незакрытыми. |
| Benchmark Memory 2.0 на multi-seed/holdout | TODO | Нужны заранее зафиксированный baseline/candidate, holdout и проверка противоречий/стоимости; прирост пока не заявляется. |
| Clean-room restore/rollback, long-duration soak, release SBOM/provenance | TODO | Не выполнялись как полноценные release gates. |

**Weighted roadmap после WorkPass 6: 60,0%** (+3,0 п.п. относительно WorkPass 5). Это прогресс реализации, не релизная готовность. Текущая шкала и открытые ворота: `docs/PROJECT_PROGRESS_SCORECARD_2026-10-09.json`.

Подробный implementation report: `docs/WORKPASS6_AGENCY_REAFFERENCE_2026-10-09.md`.


### Дополнение — WorkPass 7: KnownEntityDossier + Memory Retrieval Benchmark — 2026-10-09

Исторические счётчики задач выше не пересчитываются. Ниже перечислены изменения, реально реализованные поверх WorkPass 6.

| Задача | Статус | Результат / граница |
|---|---|---|
| Объединить сведения о сущности из существующих WILL/social/memory owners | DONE | `KnownEntityDossier.ts` строит read-only projection из `WillIntegrationBridge`, canonical B288 social state и MemoryOS2 с source-linked evidence. |
| Сохранить конфликты, карантин, свежесть и срок действия доказательств | DONE | Evidence классифицируется; просроченные, disputed, dormant и quarantined записи не выдаются как безопасные факты. |
| Включить dossier в настоящий обычный и proposal prompt path | DONE | Контекст ограничен confidence/sourceAuthority/freshness и проходит через `ContextBudgetLedger`, помечен как untrusted data, ссылается на canonical source IDs. |
| Реализовать baseline-vs-MemoryOS2 benchmark | DONE | Matched lexical baseline, isolated MemoryOS2 snapshot clone per query, explicit train/holdout, recall@k/MRR/precision/coverage, safety rates и раздельный retrieval/setup latency. |
| Не допустить автопродвижения по результату benchmark | DONE | Harness выдаёт только candidate eligibility для отдельной проверки; live state, memory, policy и identity не изменяются. |
| Подключить диагностику к server/API/UI и Runtime Atlas | DONE | `GET /api/organism/known-entities`, `POST /api/organism/memory-benchmark`, typed client methods и Atlas surface; linkage audit требует новый seam. |
| Добавить реальные регрессии для dossier, prompt context и benchmark guardrails | DONE | Known-entity fixture, context budget test и retrieval holdout test проходят. |
| Runtime typecheck, server imports, linkage, HTTP smoke и quick audit | DONE | Runtime typecheck PASS; 10 server imports, 0 missing; 124 client routes, 48 Atlas surfaces, 5 required seams; `audit:quick` PASS. |
| Запустить benchmark на реальном размеченном корпусе с multi-seed holdout | TODO | Synthetic fixture проверяет сам harness, не production uplift. |
| Browser/mobile/Live2D E2E, dependency-complete app build, clean-room rollback/soak | TODO | Не заявлены как пройденные. |

**Weighted roadmap после WorkPass 7: 63,55% (округлённое отображение 63,6%; +3,55 п.п.).** Это реализационный прогресс, не релизная готовность. Актуальная формула и открытые ворота: `docs/PROJECT_PROGRESS_SCORECARD_2026-10-09.json`.

Подробный отчёт: `docs/WORKPASS7_KNOWN_ENTITY_MEMORY_BENCHMARK_2026-10-09.md`.

### Дополнение — WorkPass 8: целостность доказательств Memory Retrieval Benchmark — 2026-10-10

Следующий рабочий проход на базе полного архива WorkPass 7. Исторические счётчики выше не пересчитываются.

| Задача | Статус | Результат / граница |
|---|---|---|
| Запретить тихое удаление malformed/over-limit примеров на HTTP boundary | DONE | Endpoint передаёт ограниченному валидатору сырые строки; до 64 обрабатываются, excess count отражается как truncation и блокирует eligibility. |
| Выявлять повторы query, leakage между train/holdout и duplicate example IDs | DONE | Запросы нормализуются по Unicode/регистру/пунктуации; повторяющиеся группы и межвыборочное пересечение видны в `datasetIntegrity`. |
| Проверять, что relevant memory IDs существуют в переданном corpus | DONE | Неизвестные эталонные ID блокируют допуск кандидата; labels не достраиваются из предсказаний. |
| Добавить provenance gate для benchmark dataset | DONE | Для допуска требуются dataset ID/version, source reference и labeling protocol. Недостаточная provenance не считается доказательством. |
| Сделать fingerprints независимыми от порядка входных строк | DONE | Упорядочены нормализованные dataset rows и corpus rows перед SHA-256. |
| Добавить воспроизводимый paired bootstrap CI для recall@k и MRR | DONE | Seed и число bootstrap samples включаются в отчёт; интервал оценивает неопределённость по holdout-запросам. |
| Подключить новые параметры к API и регрессии | DONE | Проверены memory benchmark test, runtime typecheck и HTTP smoke; API сохраняет read-only semantics. |
| Проверить реальный production uplift памяти на независимом размеченном корпусе | TODO | Входной архив содержит только синтетическую регрессию. Production uplift и multi-seed holdout не заявляются. |
| React/Vite чистая сборка, desktop/mobile/Live2D browser E2E | TODO | Этот проход не заменяет отсутствующие UI dependencies и настоящие браузерные испытания. |
| Clean-room restore/upgrade/rollback, multi-hour soak и final SBOM/provenance | TODO | Остаются релизными воротами. |

**WorkPass 8 — завершённый кодовый пакет, не release sign-off.** Исторический scorecard WorkPass 7 (63,55%) намеренно не повышен: данные для обоснованного пересчёта общей зрелости пока не собраны.
Подробный отчёт: `docs/WORKPASS8_MEMORY_BENCHMARK_EVIDENCE_2026-10-10.md`.


### Дополнение — WorkPass 9: idempotency и защита от дублирующих внешних действий — 2026-10-10

Исторические счётчики задач не пересчитываются; это отдельный законченный пакет поверх WorkPass 8.

| Задача | Статус | Результат / граница |
|---|---|---|
| Различать replay и конфликт idempotency key в Conscio peer messages | DONE | Идентичный запрос возвращает исходное сообщение; тот же ключ для другого sender/recipient/space/payload даёт `idempotency-key-conflict` и не создаёт запись. |
| Защитить Hexis outbox от повторного использования ключа для другой операции | DONE | Ключ связывается с kind/channel/canonical payload; конфликт возвращается явно, включая для ранее сохранённых строк. |
| Запретить пустой idempotency key для Hexis outbox | DONE | Пустой ключ больше не объединяет несвязанные операции; API возвращает HTTP 400. |
| Сохранить дедупликацию после terminal failed статуса | DONE | Повтор с тем же ключом не создаёт вторую отправку при неопределённости remote side effect; другой payload требует отдельного ключа и получает HTTP 409. |
| Включить наблюдаемые счётчики конфликтов | DONE | `peerIdempotencyConflicts` и `outboxIdempotencyConflicts` входят в канонические состояния и сохраняются через существующие snapshot owners. |
| Проверить поведение адаптеров и настоящего HTTP пути | DONE | Пройдены Conscio/Hexis adapter tests и оба server smoke, включая replay, conflict и missing-key случаи. |
| Добавить воспроизводимую команду пакета | DONE | `npm run audit:workpass9` запускает адаптерные + HTTP регрессии, runtime typecheck и аудит связности. |
| Full React/Vite build, browser/mobile/Live2D E2E, real-corpus Memory 2.0 evaluation и release recovery/soak | TODO | Эти релизные ворота этим пакетом не закрывались и остаются в общей очереди. |

**Граница WorkPass 9:** укреплена защита от случайной семантической смены idempotency key в двух уже существующих адаптерах. Это снижает риск тихих повторов и неверного replay, но не доказывает exactly-once delivery в произвольной внешней системе: подтверждение удалённой стороны и восстановление транспорта всё ещё требуют отдельного end-to-end протокола.

### Дополнение — WorkPass 10: WILL transport и replay reliability — 2026-10-10

Исторические счётчики и предыдущие списки задач не пересчитываются. WorkPass 10 продолжает каноническую базу WorkPass 9; новые DONE относятся только к этому пакету.

| Задача | Статус | Результат / граница |
|---|---|---|
| Привязать WILL envelope ID к семантическому отпечатку запроса | DONE | Тот же канонический запрос возвращает прежний envelope; повтор ID с другим payload/source/type/tick/correlation отклоняется с `transport-envelope-id-conflict`. |
| Сохранить ограниченный idempotency index через snapshot/restore | DONE | До 4096 отпечатков; старые snapshots backfill-ятся из retained queue/pending/replay и получают defaults для новых счётчиков. |
| Устранить молчаливую потерю очереди под нагрузкой | DONE | Очередь при 256 элементах выдаёт `transport-queue-full`; pending capacity ограничивает drain, а не удаляет старые pending элементы. Backpressure и rejected items отражаются отдельными счётчиками. |
| Укрепить ACK контракт | DONE | Неизвестный envelope не отмечается подтверждённым; конфликтующая повторная ACK отклоняется; exact duplicate ACK дедуплицируется; ACK удаляет задачу также из queued списка. |
| Предотвратить повторный replay и replay-of-replay | DONE | Replay-ID регистрируется в том же idempotency index, история bounded; повторный вызов не создаёт новый клон той же операции. |
| Отдавать точные HTTP статусы транспортных ошибок | DONE | Envelope collision/history ambiguity → 409, queue pressure → 503; unknown ACK → 404, ACK conflict → 409, invalid input → 400. |
| Проверить Lumina→Will inbound replay на уровне HTTP | DONE | Тот же explicit ID с отличающимся содержимым → 409; прежняя reservation без committed result → fail-closed `idempotency-outcome-unknown` (409). |
| Добавить регрессии и одну повторяемую команду прохода | DONE | 14 WILL bridge/transport tests, Conscio/Hexis adapter + HTTP checks, server smoke, runtime typecheck, 10 server imports, 124 client routes/48 Atlas surfaces, Memory benchmark regression и asset audit прошли. |
| Проверить exactly-once delivery через реальные внешние провайдеры и reconnect/replay stress | TODO | Текущие регрессии не доказывают exactly-once внешнее исполнение; необходимы provider receipts, retry/timeout/disconnect injection и remote postconditions. |
| Полный React/Vite production build и desktop/mobile/Live2D browser E2E | TODO | Не объявляются выполненными этим workpass. |
| Реальный размеченный multi-seed Memory 2.0 holdout | TODO | Synthetic regression подтверждает harness, не production uplift. |
| Clean-room install/restore/upgrade/rollback, multi-hour soak, final SBOM/provenance | TODO | Остаются релизными воротами. |

**WorkPass 10 — законченный пакет реализации, не release sign-off.** Общий исторический scorecard не пересчитывался: для нового взвешенного процента не собран независимый набор evidence, и нельзя подменять его числом закрытых задач.

Подробный отчёт: `docs/WORKPASS10_TRANSPORT_RELIABILITY_2026-10-10.md`.



### Дополнение — WorkPass 11: воспроизводимость Memory 2.0 и offline benchmark — 2026-10-10

Исторические счётчики не пересчитываются. В этом проходе улучшена доказательная инфраструктура существующего MemoryOS2; новый владелец памяти или поискового ранжирования не создавался.

| Задача | Статус | Результат / граница |
|---|---|---|
| Включить все rank-relevant поля памяти в corpus fingerprint | DONE | Канонический SHA-256 учитывает полное содержимое каждой строки памяти, включая веса, векторы, links, valid window, revision и provenance.
| Отдельно фиксировать retrieval policy/configuration | DONE | Добавлен `retrievalConfigurationFingerprint` для adaptive policy state и счётчиков, влияющих на выбор политики.
| Проверять целостность самого корпуса | DONE | Malformed rows, duplicate IDs и corpus truncation наблюдаемы и блокируют candidate eligibility.
| Усилить проверку безопасности возвращаемых записей | DONE | Учитываются future-valid, dormant и unsupported epistemic-status результаты; небезопасный результат блокирует eligibility.
| Поддержать офлайн оценку реального размеченного набора больше HTTP лимита | DONE | Новый runner принимает экспорт `MemoryOSState2`, JSONL labels и обязательный provenance sidecar; ограничение — до 512 примеров и bounded input size. HTTP endpoint сохраняет старый лимит 64.
| Добавить bootstrap-seed sensitivity и проверку детерминизма | DONE | 3–9 distinct seeds; point metrics и fingerprints должны оставаться стабильными; CI sensitivity сводится в отчёт. Seeds меняют bootstrap resampling, а не обучают retrieval.
| Не допустить автоматическое продвижение | DONE | Эксперимент всегда возвращает `promotion.allowed=false`; успех может означать только eligibility для независимого review.
| Добавить регрессию CLI на input files, report output и запрет overwrite | DONE | Проверяется snapshot/JSONL/provenance read path и атомарно не перезаписываемый выходной файл.
| Провести реальную оценку на независимом размеченном проектном корпусе | TODO | Такой корпус не предоставлен/не упакован; synthetic fixture остаётся проверкой harness, а не доказательством production uplift.
| Full React/Vite production build, browser/mobile/Live2D E2E, clean-room restore/upgrade/rollback, multi-hour soak, final SBOM/provenance | TODO | По-прежнему релизные ворота; не объявляются закрытыми.

Подробный протокол: `docs/MEMORY_RETRIEVAL_EXPERIMENT_PROTOCOL_2026-10-10.md`. Подробный отчёт прохода: `docs/WORKPASS11_MEMORY_RETRIEVAL_EXPERIMENT_2026-10-10.md`.


### Дополнение — WorkPass 12: confidence-aware Memory 2.0 gates — 2026-10-10

Исторические счётчики задач не пересчитываются; этот пакет построен поверх WorkPass 11.

| Задача | Статус | Результат / граница |
|---|---|---|
| Не допускать кандидата при неопределённой деградации MRR | DONE | Promotion требует, чтобы paired-bootstrap lower bound MRR оставался в пределах `maximumMrrRegression01`; положительной точечной оценки недостаточно. |
| Применять MRR non-inferiority gate к каждому bootstrap seed | DONE | Multi-seed experiment требует выполнения MRR tolerance во всех seed; по каждому запуску указываются failed gates. |
| Выдавать полный список причин недопуска | DONE | В benchmark report добавлена `promotion.gates` с состоянием каждого критерия: seed, целостность, provenance, объём доказательств, Recall, MRR и safety. |
| Отклонять некорректный явный bootstrap seed | DONE | Неположительные, нецелые или превышающие uint32 seed блокируют eligibility; эффективный seed записывается отдельно. |
| Публиковать офлайн-отчёт атомарно без перезаписи | DONE | Временный файл записывается и sync-ится, итог публикуется exclusive atomic link; временный файл удаляется при обработанной ошибке, готовый отчёт нельзя перезаписать. |
| Добавить регрессии и повторяемую команду | DONE | Benchmark, offline CLI, no-overwrite/temp cleanup, seed validation; `npm run audit:workpass12` завершился кодом 0. |
| Оценить Memory 2.0 на независимом реальном размеченном/temporal holdout | TODO | Реальный корпус не предоставлен; synthetic fixtures не считаются production evidence. |
| React/Vite production build, browser/mobile/Live2D E2E, clean-room restore/upgrade/rollback, soak и SBOM | TODO | Релизные ворота остаются открыты. |

Подробный отчёт: `docs/WORKPASS12_MEMORY_EVIDENCE_GATES_2026-10-10.md`.


### Дополнение — WorkPass 13: согласование release metadata и пересчёт статуса — 2026-10-10

Исторические таблицы выше оставлены без изменения. Для актуальной оценки создан отдельный нормализованный ledger, чтобы не суммировать одинаковые TODO/DONE из разных проходов.

| Задача | Статус | Результат / граница |
|---|---|---|
| Согласовать `package.json` и `SUPER_VERSION.json` | DONE | Root version теперь совпадает с SUPER_VERSION; runtime остаётся 35.40.0/schema 223. |
| Восстановить root-level audit alias для WorkPass 12 | DONE | `npm run audit:workpass12` делегирует runtime audit и asset audit. |
| Добавить проверку release metadata/lockfile contract | DONE | `tools/verify-release-metadata.mjs` сверяет версии, nested lockfiles, runtime, pass lineage, release status и требуемые команды. |
| Добавить regression tests для release metadata contract | DONE | Fixture tests закрывают успешный контракт, version mismatch и lockfile drift. |
| Добавить воспроизводимую агрегированную команду WorkPass 13 | DONE | `npm run audit:workpass13` запускает contract checks, WorkPass 12 suite и asset audit. |
| Исправить команду установки в README/runbook | DONE | `npm --prefix app ci` заменена на `npm run install:all`, которая запускает `npm ci` с `cwd=app`; validator проверяет инструкции. |
| Свести отчёты 9–10 октября в недублирующий статус задач | DONE | 40 нормализованных deliverables: 23 DONE, 9 PARTIAL, 8 TODO; scorecard пересчитан с сохранением фиксированных весов. |
| Установить app dependencies и выполнить React/Vite build | TODO | Попытка `npm ci` остановилась на registry DNS `EAI_AGAIN`; dependency-complete build не заявлен. |
| Провести browser E2E, clean-room restore/rollback, real MemoryOS2 temporal holdout и soak | TODO | Перенесены в отдельные крупные work packages с чёткими критериями приёмки. |

**Текущий взвешенный implementation-roadmap score: 67,80%** (+4,25 п.п. относительно исторического WorkPass 7 scorecard 63,55%). Этот процент не означает release readiness.

Полный сводный отчёт: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS13.md`. Машиночитаемый инвентарь: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS13.json`.


### Дополнение — WorkPass 14: UI regression isolation и fail-closed browser baseline — 2026-10-10

Исторические таблицы выше не переписываются; актуальный инвентарь с 42 уникальными deliverables находится в `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS14.json`.

| Задача | Статус | Результат / граница |
|---|---|---|
| Изолировать PWA/share-card тесты от локального `site.json` и `public/` | DONE | Закрыты 8 flaky/false-failing тестов из-за утечки реального workspace в fixture; `app/scripts/**/*.test.mjs` проходит 203/203. |
| Учитывать сигнатуры console/page errors, а не только общее количество | DONE | Новая ошибка при существующих baseline warnings, замена ошибки при том же count и рост повторов теперь выявляются. |
| Возвращать ненулевой exit code при явном baseline regression | DONE | Exit 3 при UI baseline drift; HTTP/navigation 1 и текущие console/page errors 2 сохраняют более высокий приоритет. |
| Добавить регрессии browser smoke | DONE | `browser-smoke-verdict` 46/46 PASS. Реальный Playwright run не заявлен: app deps отсутствуют. |
| Сделать release metadata contract привязанным к активному WorkPass | DONE | Выбор текущего status/scorecard файла идёт по build lineage; отсутствующий файл активного прохода блокирует gate. |
| Выполнить dependency-complete app typecheck/build/browser E2E | TODO | Registry DNS `EAI_AGAIN`; app TypeScript tests не могут импортировать `@tanstack/react-start` и `jose`. |

**WorkPass 14 weighted implementation estimate: 67.95%** (+0.15 п.п. к WorkPass 13); задачи: 25 DONE / 9 PARTIAL / 8 TODO, 42 уникальных deliverables. Это не release readiness.


### Дополнение — WorkPass 15: Runtime Evidence Bus и проверка исхода действия — 2026-10-10

Это дополнение фиксирует новые задачи поверх WorkPass 14; исторические счётчики выше не пересчитываются.

| Задача | Статус | Результат / граница |
|---|---|---|
| Сделать идентификаторы RuntimeEvidenceBus детерминированными и уникальными в последовательности snapshot/restore | DONE | Монотонный sequence ID, backward-compatible восстановление старого snapshot без sequence. |
| Ограничить payload evidence и устранить aliasing с вызывающим кодом | DONE | Bounded depth/keys/arrays/strings/total budget; immutable snapshot return, payload truncation marker. |
| Нормализовать causal parent links и fail-fast входы | DONE | Убираются пустые/повторяющиеся/self links; invalid kind/tick отвергаются явно. |
| Сохранить семантику lifetime counters и отделить buffered-window показатели | DONE | `byKind`/`total` отражают накопленные события; `bufferedByKind` и buffered count отражают текущий буфер. |
| Восстанавливать bus из частичного/повреждённого snapshot безопасно | DONE | Дубликаты/невалидные rows отбрасываются, confidence/payload/parents нормализуются, counters согласуются. |
| Изолировать input/result от mutation зарегистрированного OutcomeVerifier | DONE | Verifier получает глубокую замороженную копию; попытка мутации приводит к fail-closed результату, live action state не меняется. |
| Требовать строгую базу и непустой observation receipt для внешней верификации | DONE | Unsupported/none basis, whitespace observationId, исключение verifier или non-serializable context дают `unverified`. |
| Ограничить verifier note/postcondition text и не раскрывать raw exception details | DONE | Возвращаемые поля bounded; наружу выдаётся стабильная безопасная причина отказа. |
| Добавить регрессии и повторяемую команду WorkPass 15 | DONE | `big-pass-128`, `big-pass-129`; существующие evidence/reafference/agency/memory regressions; root/runtime `audit:workpass15`. |
| Ограничить startup polling server smoke, сделать его child-exit aware и независимым от cwd вызывающей команды | DONE | Новый `pollUntilReady` с global deadline/per-probe timeout и unit-test на ready/early-exit/deadline/error; bounded process cleanup; runtime root разрешается через `import.meta.url`, поэтому вызов из root-пакета запускает правильный серверный entrypoint. |
| Закрыть полную цепочку action → независимый remote receipt → persistence → reafference | PARTIAL | Локальная изоляция и codec проверяются; external provider receipts/no-double-credit stress/browser E2E ещё нужны. |
| Установить app dependencies, выполнить root/app typecheck, React/Vite production build и реальный browser E2E | TODO | Registry ранее возвращал `EAI_AGAIN`; отсутствующие UI зависимости не маркируются как установленная сборка. |

Подробный отчёт: `docs/WORKPASS15_CLOSED_LOOP_EVIDENCE_HARDENING_2026-10-10.md`.
Актуальный нормализованный реестр: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS15.json`.

### Дополнение — WorkPass 16: Browser release gate и атомарные verdict-отчёты — 2026-10-10

Исторические счётчики не переписываются. Новые deliverables добавлены в отдельный актуальный inventory `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS16.json`.

| Задача | Статус | Результат / граница |
|---|---|---|
| Сделать blocking brand warnings реальным browser-smoke gate | DONE | `BRAND WARNING:` → ненулевой exit; `BRAND NOTE:` advisory, чтобы plain utility exception сохранился. |
| Не скрывать auth divergence и indeterminate probe | DONE | `authInvariant.status/message` пишутся в verdict; `diverged` блокирует, `indeterminate` явно отображается без ложного agreement. |
| Ограничить BROWSER_SMOKE_TIMEOUT_MS | DONE | Только целое 1000–180000 мс; неправильные значения отклоняются до запуска Chromium. |
| Атомарно публиковать browser verdict JSON | DONE | Same-directory temp, mode 0600, fsync, atomic rename; failure сохраняет старый complete verdict и очищает temp. |
| Добавить unit regressions и root audit command | DONE | App script suite 212/212 PASS; добавлена `npm run audit:workpass16`. |
| Установить app dependencies, выполнить production build и настоящий Playwright E2E | TODO | `npm ci` timed out while registry unavailable; build/browser execution not claimed. |

**WorkPass 16:** normalized inventory 51 tasks — 34 DONE, 9 PARTIAL, 8 TODO; weighted implementation estimate 68.65%, not release-ready.

Подробный отчёт: `docs/WORKPASS16_BROWSER_RELEASE_GATE_2026-10-10.md`.
Актуальный статус: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS16.md`.

| Сохранить совместимость metadata gate со старыми workpass fixtures | DONE | Новое требование к standalone memory experiment применяется к WorkPass16+, а валидный WorkPass14 fixture остаётся зелёным; contract tests 6/6 PASS. |


### Дополнение — WorkPass 17: настоящее проектное исследование и evidence-gated DAG — 2026-10-10

| Задача | Статус | Результат / граница |
|---|---|---|
| Убрать повторное внутреннее чтение из шага независимого подтверждения | DONE | `repeat` обращается к `organism.project.research`, а не к context/evidence tool. |
| Не завершать research-step до получения внешнего источника и promotion | DONE | `completeToolStep` требует внешний результат и флаг promotion для соответствующих шагов; consolidation требует ранее promoted claim. |
| Проверять URL и network policy до расходования бюджета | DONE | `preflightUrl` проверяет enabled, URL, HTTPS, private host и allowlist; отказ не расходует retry budget. |
| Не продвигать claim по двум доменам с одинаковым content hash | DONE | External firewall promotion требует минимум два source identities и два content hashes. |
| Восстанавливать source/content diversity метрики | DONE | `ProjectResearchSession.restore` пересчитывает diversity и берёт promotion state от canonical firewall. |
| Разделить ingestion evidence и completion DAG step | DONE | `ingestExternalProjectResearch` не завершает шаг самостоятельно; это делает executor после gate-check. |
| Не списывать retry budget шага из-за отказа другого инструмента | DONE | Failure применяется только при совпадении инструмента с `preferredTool`. |
| Покрыть реальный Core preflight, project life/recovery/scheduler и старые firewall regressions | DONE | `audit:workpass17`, `test:big-pass-175`, recovery/scheduler, runtime tsc и UI/API linkage — PASS. |
| Проверить работу с реальным внешним provider и несколькими разрешёнными доменами | TODO | Требует рабочей сетевой конфигурации и доступных источников; сеть не симулируется как production evidence. |
| React/Vite build, browser/Live2D E2E, clean-room restore/rollback, soak и SBOM | TODO | Ранее обнаруженные UI dependency/network/release blockers остаются открытыми. |

Подробный отчёт: `docs/WORKPASS17_PROJECT_RESEARCH_CLOSURE_2026-10-10.md`. Общий roadmap percentage в этом проходе не пересчитывался; WorkPass 16 68.65% остаётся историческим baseline, а не release readiness.


### Дополнение — WorkPass 18: защищённый, query-bound внешний research transport — 2026-10-10

Ниже только новые deliverables этого прохода; исторические таблицы не переписываются.

| Задача | Статус | Результат / граница |
|---|---|---|
| Реализовать HTTPS transport с DNS pinning против rebinding/SSRF | DONE | Каждый hop разрешается через DNS, весь набор адресов проверяется на public-only, соединение закрепляется за проверенным IP, TLS проверяется на исходном hostname. |
| Добавить policy-safe redirect и ограничения ответа | DONE | Каждый redirect повторно проходит HTTPS/allowlist/DNS checks; лимит redirect, общий timeout и DNS deadline, max bytes, textual content-type gate. |
| Привязать внешние источники к конкретному исследовательскому запросу | DONE | Обязательный query минимум с тремя содержательными терминами; query SHA-256 включён в cache identity и canonical firewall claim key. |
| Не принимать нерелевантный контент как внешнее evidence | DONE | Lexical relevance gate; confidence передаётся в EvidenceFirewall с attenuation по релевантности. Это topicality check, не semantic entailment proof. |
| Добавить transport, redirect, DNS/private-address, timeout, size/content-type, query relevance и cache regressions | DONE | `tests/big-pass-180-external-research-transport.mjs` — 13 сценариев; `npm run test:project-research-gates` и runtime `tsc` проходят. |
| Выполнить живое внешнее подтверждение на двух реальных разрешённых доменах | TODO | DNS сети в текущем окружении не работает (`dns-resolution-failed` на `example.com`); live provider promotion не заявляется. |
| Проверить semantic entailment против утверждения и ложное keyword-overlap на размеченной выборке | TODO | Текущий gate лексический; следующий этап — assertion extraction/entailment либо отдельный проверяемый verifier, без подмены доказательства релевантностью. |
| Full React/Vite production build и desktop/mobile/Live2D browser E2E | TODO | UI зависимости отсутствуют и registry ранее был недоступен; остаётся релизным блокером. |

Подробный отчёт: `docs/WORKPASS18_EXTERNAL_RESEARCH_TRANSPORT_2026-10-10.md`. Актуальный инвентарь: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS18.json`.


### Дополнение — WorkPass 19: интеграция research provenance в каноническую память — 2026-10-11

| Задача | Статус | Результат / граница |
|---|---|---|
| Встроить внешние фрагменты в существующий MemoryOS2 без параллельного memory owner | DONE | Одиночный источник остаётся в ограниченной research session; после разнообразия издателей и хешей обе записи сохраняются в каноническую память как `hypothesis`, confidence ≤ 0.54. |
| Вычислять source identity по реальному serving host, а не доверять independence key | DONE | Нормализация поддоменов, распространённых многосоставных suffix и multi-tenant хостов; restore legacy rows использует тот же путь. Это dependency-free таблица common cases, не полный Public Suffix List. |
| Разделять конфликт версии одной страницы и разные страницы одного издателя | DONE | `EvidenceFirewall` хранит `documentKey`: изменение контента той же страницы конфликтует, а две разные страницы одного издателя не превращаются автоматически в противоречие; source identity остаётся одна. Legacy observations без documentKey обрабатываются консервативно. |
| Карантинить сохранённые research notes при конфликте | DONE | EvidenceFirewall conflict/rejection возвращает бывшие hypotheses в `quarantined`, исключая их из нормального recall. |
| Перенести source provenance и status через миграцию/перезапуск | DONE | URL, source host/key, title, snippet, content type, query/content hashes, trust/relevance и fetchedAt ограничены по размеру; `firewallStatus` сохраняется. |
| Реальные Core transport/session/memory/restart regressions | DONE | WorkPass 19 Core test подтверждает single-source hold, 2-source hypothesis integration, conflict quarantine и восстановление после перезапуска; transport suite 14 сценариев, runtime TypeScript compiler — PASS. |
| Semantic claim-support verifier: support/refute/unknown вместо lexical relevance и diversity | TODO | Не заявлять истинность утверждения на основании количества источников; следующий проход создаёт claim-specific verifier и набор ложного keyword-overlap. |
| Живое внешнее исследование на двух разрешённых доменах | TODO | Требует доступного DNS/provider и отдельной рабочей конфигурации. |
| Production build, browser/Live2D E2E, clean-room upgrade/rollback, soak и SBOM | TODO | Остаются release gates; обновление runtime не означает готовность релиза. |

**Оценка после WorkPass 19:** 69.90% по взвешенной дорожной карте реализации (не готовность релиза); 6.5/10 как исследовательская платформа, 3.2/10 как продукт к выпуску.

Подробный отчёт: `docs/WORKPASS19_RESEARCH_MEMORY_INTEGRATION_2026-10-11.md`. Текущий статус: `docs/PROJECT_CURRENT_STATUS_2026-10-11_WORKPASS19.md` и `docs/PROJECT_CURRENT_STATUS_2026-10-11_WORKPASS19.json`.


### WorkPass 24 — NLI readiness and model-version provenance — 2026-10-11

| Изменение | Статус | Результат / ограничение |
|---|---|---|
| Развести process liveness и model readiness (`/livez`, `/healthz`, `/readyz`) | DONE | Liveness healthy не означает, что модель готова; `/readyz` возвращает 503 до загрузки и выдаёт только безопасный код состояния. |
| Не повторять загрузку модели на каждом inference после сбоя | DONE | Введён ограниченный cooldown и санитарные коды ошибки; `--lazy-model-load` опционально поднимает health endpoints на время warmup. |
| Пронести точную model revision через NLI → claim quotes → aggregate | DONE | Provenance сохраняет model ID и revision; смена модели в пределах одной оценки закрывается как `unknown`. |
| Защитить persisted research state от смешения model revisions | DONE | Restore отклоняет семантические цитаты с revision, расходящейся с родительской оценкой; старые данные без revision сохраняются для совместимости. |
| Выполнить реальный pretrained NLI inference и получить результаты на независимом holdout | TODO | В этом окружении нет доступа к registry DNS и не загружены веса; mocked tests не считаются доказательством качества модели. |
| Production build React/Vite и реальные браузерные E2E | TODO | Зависимости приложения не установлены из-за сетевого блокера; остаётся релизным gate. |

WorkPass 24: 2 новых нормализованных deliverables закрыты; основные acceptance tests: semantic NLI 23, Python service 10, evaluator 4, Core research gate PASS, memory benchmark PASS (promotion по-прежнему `not-promoted`).

## WorkPass 26 — 11 октября 2026 — реальные изменения языка и контекста

- [DONE] **G78 — Граница доверия prompt-контекста.** MemoryOS2 summaries, dossier, world facts, world-model/state and fused observations now pass as JSON-escaped untrusted data blocks in the data/user message, not the trusted system instruction. Prompt text is defence-in-depth; tool permissions remain enforced in code.
- [DONE] **G79 — Честный omission ledger.** Removed early clipping of user input/fused observation/workspace JSON before the centralized budgeter; the ledger sees the full original string, hashes it, and indicates what was actually truncated. Explicitly records selection counts for last-4 memories and last-12 world facts.
- [DONE] **G80 — Strict CognitiveProposal schema.** Exact five-key schema, length/item bounds, finite uncertainty in [0,1], allowlisted action. Invalid model output becomes uncertainty=1 and no action; local fixed fallback prose remains separate.
- [PASS] Runtime `tsc`; prompt/context regressions; research transport/Core gates; idempotency; MemoryOS2 retrieval harness.
- [OPEN] UI dependency installation/build and browser E2E; real pinned NLI model/labelled holdout; independent temporal MemoryOS2 holdout; clean-room recovery/rollback; soak and SBOM/release provenance.

**Current normalized tracker:** 80 deliverables — 59 DONE, 11 PARTIAL, 10 TODO. **Weighted roadmap 72.15%**; not release readiness.


## WorkPass 28 — durable write-ahead journal, restart-safe compensation and single-writer ownership

1. [P0][DONE] **WP28-01 — Фиксировать intent до вызова side-effect tool.** ActionGateway fsync-ит `execution-started` с executionId/toolId/canonical input hash прежде, чем вызвать исполнитель; отказ записи запрещает действие.
2. [P0][DONE] **WP28-02 — Привязать завершение к точной квитанции.** `execution-finished` хранит хеш входа и результата, outcome, accepted/verified/uncertain; чужой execution/tool/hash не проходит state-transition gate.
3. [P0][DONE] **WP28-03 — Не сохранять сырые параметры действия.** В журнал не попадают произвольный пользовательский текст, raw input или результат; только ограниченные идентификаторы, hashes и перечисленные поля статуса.
4. [P0][DONE] **WP28-04 — Цепочка целостности записей.** Каждая строка получает sequence number, previous hash и SHA-256 текущей канонической записи; переписывание, пропуск записи и неизвестное событие блокируют восстановление.
5. [P0][DONE] **WP28-05 — Fail-closed при повреждении/обрезанном хвосте.** Некорректный JSON, torn line, невозможный переход и превышение максимального размера запрещают выполнение новых side effects и требуют ручной сверки.
6. [P0][DONE] **WP28-06 — Долговечно расходовать попытку компенсации до inverse.** `compensation-started` записывается и fsync-ится до вызова compensator; crash между записью и завершением оставляет consumed attempt и запрещает слепой replay.
7. [P0][DONE] **WP28-07 — Проверять исходный receipt после перезапуска.** Compensator доступен только при наличии завершённого исходного receipt, accepted execution, безопасном outcome и совпадающих execution/tool/input/result hashes.
8. [P0][DONE] **WP28-08 — Сделать неизвестный исход явным.** Throw-after-write, отсутствие verifier и ошибка записи финальной квитанции остаются `uncertain`/manual reconciliation; ответ инструмента сам по себе не доказывает внешний postcondition.
9. [P0][DONE] **WP28-09 — Запретить конкурирующих владельцев журнала.** Эксклюзивный lock исключает два процесса, которые независимо назначили бы sequence number и повредили append-only chain.
10. [P0][DONE] **WP28-10 — Не перехватывать stale lock автоматически.** Lock после аварийного выхода остаётся fail-closed; его владелец/токен показывается в bounded диагностике, оператор должен сохранить journal и сверить внешнее состояние перед удалением lock.
11. [P0][DONE] **WP28-11 — Сохранить pending и uncertain записи при compaction.** Обрезание истории удаляет только завершённые безопасные старые receipts, оставляет unresolved execution/compensation и не авторизует компенсацию для истёкших receipts.
12. [P0][DONE] **WP28-12 — Ограничить объём, глубину и retention журнала.** Canonical JSON hashing отвергает циклические/non-JSON/non-finite/oversized payload; журнал имеет жёсткий предел, а исчерпание capacity блокирует действие.
13. [P1][DONE] **WP28-13 — Уплотнять атомарно и синхронно.** Compaction пишет новый hash chain во временный файл, fsync-ит файл, атомарно заменяет журнал и fsync-ит родительскую директорию.
14. [P1][DONE] **WP28-14 — Добавить безопасную read-only диагностику.** `/api/runtime/compensation-journal` показывает integrity/readiness, unresolved IDs/statuses и причину ручной сверки, не раскрывая raw input/result/hash fields; server smoke это фиксирует.
15. [P1][DONE] **WP28-15 — Закрывать journal lease при штатном останове.** Runtime ждёт завершения очереди/flush, закрывает continuity ledger и освобождает только собственный lock token; shutdown сервера теперь ожидает `runtime.stop()`.

### WorkPass28 — фактическая приёмка

- Runtime TypeScript: PASS; durable journal suite: **13/13 PASS** (write-ahead, receipts, restart, replay refusal, binding, corruption, hash-chain tamper, compaction, concurrency, stale lock, owner-safe release).
- HTTP server smoke проверяет `/api/runtime/compensation-journal`, валидную готовность и отсутствие payload/hash-материалов в диагностическом ответе.
- Корневой `npm run audit:workpass28` запускает release metadata, app/browser source gates, context and compensation tests, runtime research/recovery, durable journal suite, HTTP smoke, server imports, UI/API linkage и asset checks.
- MemoryOS2 benchmark отдельно: `npm run audit:workpass28:memory`; candidate не promoted без независимого temporal holdout и BM25 non-regression evidence.
- Это локальная durability и at-most-once compensation, **не** provider-side exactly-once: нужны удалённые idempotency keys/receipts и проверка postcondition на целевом провайдере.

### Текущие итоги после WorkPass28

- **210 детализированных задач:** P0: 77; P1: 116; P2: 17.
- DONE: 33; PARTIAL: 89; TODO: 84; BLOCKED: 4.
- Нормализованный инвентарь: **85 deliverables — 64 DONE, 11 PARTIAL, 10 TODO**.
- Weighted implementation roadmap: **72,85%** (+0,50 п.п.), не release readiness.
- Следующие blockers: production UI build/browser E2E; реальный pinned NLI inference и holdout; независимый temporal memory holdout; provider-side receipt/replay/reattachment; clean-room restore/upgrade rollback; soak; SBOM/provenance и sign-off.



## WorkPass 29 — durable action idempotency and provider receipt contract

1. [P0][DONE] **WP29-01 — Validate and scope caller idempotency keys.** Keys are trimmed, bounded printable strings and are namespaced by tool ID; only a SHA-256 hash is persisted. Raw keys never enter the journal or diagnostics.
2. [P0][DONE] **WP29-02 — Require durable journal ownership for keyed execution.** If a caller supplies `idempotencyKey` without a configured durable journal, ActionGateway refuses execution rather than silently degrading to process-local semantics.
3. [P0][DONE] **WP29-03 — Suppress completed duplicate executions.** The journal returns the original execution receipt metadata and ActionGateway declines to invoke the tool a second time for a completed identical request.
4. [P0][DONE] **WP29-04 — Fail closed for in-progress and uncertain requests.** An unresolved write-ahead record under the same key returns a pending/manual-reconciliation result; no automatic replay is performed after a crash or ambiguous external timeout.
5. [P0][DONE] **WP29-05 — Reject same-key/different-input reuse.** A key bound to a different tool or canonical input hash is refused, never interpreted as a new operation.
6. [P0][DONE] **WP29-06 — Preserve idempotency tombstones through compaction.** Compaction retains every keyed execution receipt; if this eventually hits the bounded journal capacity, the gateway fails closed rather than making old keys reusable.
7. [P0][DONE] **WP29-07 — Serialize concurrent same-key calls.** Concurrent requests share the durable journal serializer; exactly one request starts the handler and others receive pending/duplicate status.
8. [P1][DONE] **WP29-08 — Pass a stable provider idempotency key to adapters.** The execution context receives a namespaced derived key and key hash, not the raw caller key, so capable adapters can forward a stable header/token to their provider.
9. [P1][DONE] **WP29-09 — Persist validated opaque provider receipts.** Bounded provider name and receipt ID can be stored with the execution-finished event and survive restore/compaction; invalid receipt shapes are not persisted.
10. [P1][DONE] **WP29-10 — Keep receipts and caller keys out of public diagnostics.** Snapshot endpoints expose counts/status only; audit summaries redact provider receipt objects. The keyed retry result returns only the bounded opaque receipt to the caller that supplied the same key.
11. [P1][DONE] **WP29-11 — Expose idempotency counters.** Read-only journal stats now report number of keyed receipts and provider receipts without revealing any identifiers.
12. [P1][DONE] **WP29-12 — Propagate options through Core and Runtime.** `executeTool`, `executeProjectTool`, and `executeNextProjectStep` accept optional idempotency options without changing legacy callers that omit them.
13. [P1][DONE] **WP29-13 — Preserve legacy unkeyed execution.** Existing calls without `idempotencyKey` keep their previous behavior and old journal rows remain readable.
14. [P1][DONE] **WP29-14 — Validate journal events before append.** Invalid idempotency hashes or partial/malformed provider receipt metadata are rejected before writing a line, avoiding an in-memory transition failure after append.
15. [P1][DONE] **WP29-15 — Add restart, concurrency, compaction and privacy regressions.** Durable journal suite covers duplicate suppression in-process and across restart, key mismatch, unresolved intent, provider receipt persistence, redaction and tombstone retention.
16. [P0][PARTIAL] **WP29-16 — Integrate provider-side idempotency in real adapters.** The ActionGateway context contract exists, but actual external adapters must forward `providerIdempotencyKey`, inspect provider-specific receipt semantics/retention, and run a live staging replay test before provider-side exactly-once can be claimed.

### WorkPass29 acceptance evidence

- Runtime TypeScript compiler PASS; focused durable-action-journal suite **17 cases PASS**; Core/MotorSchema compensation gate and HTTP server smoke are part of the root gate.
- Root `npm run audit:workpass29` is the current bounded gate; the memory retrieval benchmark remains a separate command and is not implied by root pass.
- Raw caller idempotency key is never written to journal. Stable provider keys are available to adapters. Provider receipt IDs stay out of the public diagnostics snapshot.
- The local gateway suppresses repeated execution, but provider-side exactly-once is not asserted until real remote adapters honor the forwarded key.
- UI production build/browser E2E, actual pinned NLI inference and independent NLI/memory holdouts remain open.

### Current detailed backlog totals after WorkPass29

- **226 detailed items:** 48 DONE, 90 PARTIAL, 84 TODO, 4 BLOCKED. P0=85, P1=124, P2=17.
- **88 normalized deliverables:** 66 DONE, 12 PARTIAL, 10 TODO. G86/G87 are DONE; G88 remains PARTIAL pending real-provider adapter proof.
- Weighted implementation roadmap: **73.25%** (+0.40 percentage points against WorkPass28); this is not release readiness.
- Canonical file remains `/Нейро Курису/Neuro_Kurisu_FULL_RELEASE_BACKLOG_CANONICAL.md`; refresh the Library copy and the full current to-do list after every material pass.

## WorkPass29 — учёт фактической поставки и следующий шаг

- Сравнение SHA-256 с WorkPass28: 10 новых содержательных файлов, 18 изменённых, 0 удалённых; manifest учитывается отдельно.
- Закрыто 15 детализированных пунктов WP29-01…WP29-15. WP29-16 остаётся PARTIAL до staging-подтверждения реального внешнего провайдера.
- Не повторять завершённые пункты: следующий приоритет — интегрировать `providerIdempotencyKey` в настоящие side-effect adapters и проверить replay/receipt semantics у провайдера, затем закрыть UI build/E2E и независимые NLI/MemoryOS2 holdouts.
- Всегда обновлять этот полный список и `/Нейро Курису/Neuro_Kurisu_FULL_RELEASE_BACKLOG_CANONICAL.md` после существенного прохода.


## WorkPass 30 — durable backup/restore and concurrent lock-reclaim hardening (11.10.2026)

### Выполнено в коде — 14 задач DONE

- [x] WP30-16: fsync state bytes and manifest before backup success.
- [x] WP30-17: schema-2 manifest digest with schema-1 backwards compatibility.
- [x] WP30-18: atomic manifest publication and parent-directory sync.
- [x] WP30-19: reject state files changed while their bytes are being captured.
- [x] WP30-20: reject symlink/non-regular source and backup paths.
- [x] WP30-21: enforce exact backup directory/file set.
- [x] WP30-22: verify every byte/hash before restore mutation.
- [x] WP30-23: stage, fsync and re-hash restore payloads before promotion.
- [x] WP30-24: restore exact state-file set and remove stale files not in snapshot.
- [x] WP30-25: save and reference a pre-restore snapshot when current state exists.
- [x] WP30-26: use the same runtime lock as a restore reservation.
- [x] WP30-27: fail closed on interrupted restore, malformed or wrong-owner locks; owner-bound release.
- [ ] WP30-28 (PARTIAL): inject mid-rename/process-kill failures and prove automated rollback or lock retention in a subprocess. Recovery code exists, but this evidence is not yet complete.
- [x] WP30-29: `super-restore --verify-only` and `docs/STATE_BACKUP_RESTORE_RUNBOOK.md`.
- [x] WP30-30 [P0]: Serialize concurrent stale runtime-lock reclamation via a token-owned `.reclaim.lock`; re-read PID/host/token under guard, fsync directory transitions, refuse concurrent reclaimers and never auto-steal stale/corrupt reclaimer locks.

### Приёмка WorkPass 30

- [x] Root `audit:workpass30` passed before the final WP30-30 patch. Post-fix aggregate rerun timed out after asset output; final affected gates were independently rerun and passed (metadata 36/36, backup/restore 9/9, ProcessLock 5/5, runtime TypeScript, server imports, UI/API linkage, assets). Do not record the post-fix aggregate as passed.
- [x] State backup/restore tests 9/9; ProcessLock tests 5/5; runtime TypeScript passes.
- [x] Archive CRC/UTF-8/no-duplicate-path checks and manifest SHA-256 comparison passed.
- [ ] Full app production build/browser E2E still blocked by missing Vite deps and `EAI_AGAIN registry.npmjs.org`.
- [ ] Real pinned NLI inference/holdout, independent temporal memory holdout and memory retrieval candidate promotion remain open.
- [ ] Provider staging receipts, clean-room restore/upgrade/rollback, soak, SBOM/provenance and sign-off remain open.

### Учёт прогресса после WorkPass 30

- 241 детализированная задача: 62 DONE, 91 PARTIAL, 84 TODO, 4 BLOCKED.
- 91 нормализованный deliverable: 69 DONE, 12 PARTIAL, 10 TODO.
- Roadmap 73.75%; эта оценка не означает release readiness.
- Текущая база: WorkPass 30 / runtime 35.53.0 / schema 224. Следующий приоритет — subprocess fault injection для rollback и production UI build; не повторять уже закрытые backup/integrity пунктов без новой причины.
- Канонический источник: `/Нейро Курису/Neuro_Kurisu_FULL_RELEASE_BACKLOG_CANONICAL.md`.


### WorkPass 30 follow-up — WP30-30 DONE

- [x] Serialize concurrent stale-lock reclaimers with a token-owned sibling `.reclaim.lock` and double-check the stale owner PID/host/token while holding it.
- [x] Do not suppress the primary acquisition error during `finally` cleanup.
- [x] Add concurrent race regression: exactly one reclaimer acquires the runtime lease; the successful owner can release cleanly; reclaimer guard is removed only by its owner.
- [x] WP30-28 was closed in WorkPass31 after child-process crash injection covered displacement, partial install, post-commit and final cleanup-window recovery. Cross-platform/power-loss testing remains PARTIAL as WP31-15.


## WorkPass 31 — durable recovery across restore crashes

1. [P0][DONE] **WP31-01** — Before changing state, fsync a transaction record binding owner/token, preimage backup, target manifest hash and exact file set.
2. [P0][DONE] **WP31-02** — Write a distinct fsynced commit marker only after the full target set is installed and verified.
3. [P0][DONE] **WP31-03** — Recover prepared transactions to a verified preimage; preserve committed target only when active files and backup provenance match.
4. [P0][DONE] **WP31-04** — Refuse recovery if the original owner is alive, cross-host, or lock/transaction metadata is malformed; retain lock on uncertainty.
5. [P0][DONE] **WP31-05** — Expose explicit `npm run restore -- --recover-interrupted --confirm-overwrite` and operator guidance in ProcessLock diagnostics/runbook.
6. [P0][DONE] **WP31-06** — Handle originally empty state without leaving partially installed files.
7. [P0][DONE] **WP31-07** — Fault-inject a child-process exit after first displacement and verify byte-accurate rollback.
8. [P0][DONE] **WP31-08** — Fault-inject an exit during install to empty state and verify safe rollback.
9. [P0][DONE] **WP31-09** — Fault-inject an exit after durable commit and finish cleanup without undoing the commit.
10. [P1][DONE] **WP31-10** — Keep synchronous exception rollback, verify the restored preimage and release owned lock/transaction.
11. [P0][DONE] **WP31-11** — Reject edited transaction metadata and retain recovery evidence instead of guessing.
12. [P1][DONE] **WP31-12** — Refuse backup capture while the runtime/restore lock exists, while allowing a proven-owned internal pre-restore snapshot.
13. [P1][DONE] **WP31-13** — Sync source/destination directories after each rename and revalidate committed backup manifest provenance.
14. [P1][DONE] **WP31-14** — Add environment-selected backup root for isolated recovery/ops and cover the actual CLI in tests.
15. [P1][PARTIAL] **WP31-15** — Verify Windows, platform-specific directory-sync and real power-loss filesystem behavior; Linux child-crash injection alone is not a universal durability proof.

### WorkPass 31 progress

- Backup/restore tests **17/17**; ProcessLock tests **6/6**.
- 95 normalized deliverables: 72 DONE, 13 PARTIAL, 10 TODO.
- 257 detailed backlog tasks: 78 DONE, 91 PARTIAL, 84 TODO, 4 BLOCKED.
- Current weighted roadmap **74.30%**, not release readiness.

16. [P1][DONE] **WP31-16** — Recover the final cleanup gap after transaction manifest removal by validating orphaned commit marker, the target backup manifest and the exact active state hashes before releasing the lock.
