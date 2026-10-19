# WorkPass 45 — глубокая интеграция восстановления внешних действий и камеры

Дата: 15 октября 2026. Базовый архив: `Neuro_Kurisu_WORKPASS44_2026-10-15.zip`. Выходная версия: `Neuro_Kurisu_WORKPASS45_2026-10-15.zip`. Runtime 35.66.0; schema 225.

## Резюме прохода

WorkPass45 продолжает `Plants.md` (инварианты архитектуры), `syns.md` (семантическая навигация) и `dous.md` (порядок интеграции). Целью было не добавить независимую подсистему, а провести уже существующие durable ActionGateway receipts/reconciliation до физического действия камеры и HTTP-границы. В ходе сверки найден и устранён direct camera bypass, а релизные версии синхронизированы.

Ключевая новая возможность — **read-only reconciliation**: после тайм-аута система может спросить адаптер о квитанции уже начатого действия без повторного запуска инструмента. Три результата имеют разные семантики:

- `found`: адаптер возвращает конкретную валидную квитанцию и исход операции; текущий ActionGateway завершает именно первоначальное выполнение.
- authoritative `not-found`: допустим только для адаптера, способного доказать, что операция не была исполнена; квитанция переводится в конечное состояние без обучения на несуществующем действии.
- `unknown`: квитанция не найдена, платформа недоступна либо доказательство невалидно. Pending сохраняется; повторное выполнение автоматически не производится; unknown не трактуется как failure/противоречие.

Это улучшает безопасность повторов, восстановление после рестарта и достоверность обучения. Протокол **не** утверждает, что каждый внешний provider уже поддерживает такой контракт.

## Реальные изменения кода

### 1. ActionGateway reconciliation

В `runtime/neuro-kurisu/src/organism/system/ActionGateway.ts` добавлен типизированный lookup receipt и метод `reconcileToolExecution`. Он находит оригинальную keyed-операцию в durable ledger, сверяет request/key identity, вызывает только read-only `ToolDefinition.reconcile`, coalesce-ит конкурентные lookup и передаёт найденный результат в существующий finalizer/commit. У `unknown` нет пути на повторный `execute`. У инструментов с `requiresIdempotencyKey` отсутствие ключа отсекается до запуска side effect.

Это использует существующий `ActionGateway`, а не новый executor/журнал. `OrganismCore` сохраняет собственную авторитетность над финализацией и причинной проекцией. Для статуса `confirmed-not-executed` добавлена отдельная семантика CEF: система не обучается на действии, которого доказанно не было.

### 2. Termux camera receipt sidecar

В `runtime/neuro-kurisu/src/organism/body/AndroidEmbodimentBridge.ts` добавлена локальная запись квитанций физического захвата:

- ключ нормализуется и связывается с хешем параметров операции (камера и сохранение изображения);
- результат проверяется по `ok`, размеру и SHA-256; retained path валидируется и повторно сверяется с хешем файла при lookup;
- запись идёт во временный файл с эксклюзивным созданием, `fsync`, ограниченными правами и атомарным link без перезаписи существующего receipt;
- точный replay того же ключа и того же результата возвращает прежний receipt, переиспользование ключа под другую операцию/результат становится явным conflict;
- повреждённая, отсутствующая или не соответствующая запросу квитанция даёт `unknown`.

Квитанция локально подтверждает, что процесс получил результат команды и сумел сохранить receipt. Это **не** квитанция, созданная самим Android/Termux. Если процесс падает после фактического захвата, но до сохранения receipt, доказать результат по локальному диску невозможно. Код намеренно оставляет состояние `unknown` вместо выдуманного `not-executed`.

### 3. Один физический исполнитель камеры

Раньше `android.capture_camera`, `EmbodiedActionExecutor` и `EmbodimentRuntime.captureCamera` давали больше одного пути к физической камере. Теперь:

- канонический инструмент — `organism.device.capture`, зарегистрированный в ActionGateway;
- `requiresIdempotencyKey: true` закрепляет требование устойчивого ключа;
- старый `android.capture_camera` перенаправляется в канонический ID как совместимый alias, но не регистрируется вторым executor;
- автоматический `EmbodiedActionExecutor` вызывает переданный callback ядра; callback использует keyed gateway и актуальный `decisionId`;
- `captureCameraForCognition` использует общий канонический путь и возвращает явный `key-required`, если реальное действие нужно совершить без ключа;
- прямой `EmbodimentRuntime.captureCamera` fail-closed и не запускает физическую операцию.

Такой дизайн не позволяет обходить durable ledger в зависимости от того, какой старый API/планировщик попросил сделать снимок.

### 4. HTTP/API guard

`POST /api/organism/vision/capture` теперь требует `Idempotency-Key` в заголовке или теле и возвращает HTTP 400 **до вызова runtime**, если ключа нет. Ответ неопределённой операции транслируется как HTTP 409, чтобы клиент не считал его подтверждённым провалом и не отправлял новый capture под новым ключом. `/capture-if-useful` может безопасно вернуть skip; если камера действительно нужна, отсутствие ключа приводит к явному отказу до side effect. Endpoint reconciliation остаётся отдельным read-only способом сверки.

`runtime/neuro-kurisu/tests/server-smoke.mjs` теперь упражняет настоящий запущенный Node HTTP server и проверяет ключевой контракт: capture без idempotency key должен вернуть `400 idempotency-key-required` до физического вызова; capture-if-useful либо не запускает камеру, либо явно требует ключ. Это сильнее статической проверки маршрута, но не является браузерным E2E.

### 5. Release contract исправлен

Сверка WorkPass44 выявила версионный дрейф: `ReleaseContract.application` / `VERSION.json` / `RELEASE_MANIFEST.json` были на 35.64.0, при том что package/lock canonical runtime и `SUPER_VERSION` указывали 35.65.0. WorkPass45 выравнивает `runtime/neuro-kurisu/package.json`, lockfile, `ReleaseContract`, `VERSION.json`, `RELEASE_MANIFEST.json`, `contracts/integration-manifest.json`, `SUPER_VERSION.json`, root package и `SBOM` на runtime 35.66.0 / root 35.0.0-super-workpass45 / WorkPass45 / state schema 225. Схема данных не менялась, потому что новый camera receipt хранится как отдельный sidecar, а не как новый persistent core field.

## Что получает пользователь от этих изменений

1. После тайм-аута система может сверить исходную keyed-операцию без повторения физического эффекта.
2. Повтор с тем же ключом возвращает исходный receipt; другой запрос под тем же ключом не переопределяет операцию.
3. Автономный планировщик, cognition capture, старый tool ID и HTTP API используют одну точку исполнения и один журнал действий.
4. Камера без ключа не запускается — это снижает риск дублей после повторов клиента/перезапуска.
5. Неизвестный результат не превращается в отрицательное свидетельство/обучение; при нехватке данных состояние честно остаётся unresolved.
6. Снимок с сохранённым изображением перепроверяется по SHA-256; изменение/исчезновение payload переводит lookup в `unknown`.
7. Готовность к внешнему провайдеру подготовлена на уровне контракта, но не заявлена без проверки реального устройства.

## Какие тесты прошли в этом проходе

- `npm run test:provider-reconciliation-workpass45` — 5 сценариев: восстановление найденной квитанции, `unknown` без learning, coalescing concurrent lookup, авторитетное отсутствие side effect без обучения и отсутствие fallback execution.
- `npm run test:camera-receipt-store-workpass45` — 5 сценариев, включая replay, key/operation binding, conflict reuse, проверку retained image hash и fail-closed corrupted metadata. Отчёт явно говорит `hardwareExecuted=false`.
- `npm run test:canonical-camera-gateway-workpass45` — 7 assertions: один canonical tool, ключ обязателен, lookup объявлен, legacy alias нормализуется, прямой runtime путь fail-closed; `physicalDeviceTouched=false`.
- `npm run test:action-gateway-idempotency-workpass37` — 13/13.
- `npm run test:action-ledger-archive-workpass38` — 4/4.
- Runtime TypeScript typecheck — PASS.
- `npm run test:smoke` — `CLEAN_ORGANISM_SMOKE=PASS`.
- `npm run test:restart` — `CLEAN_RESTART_PERSISTENCE=PASS`.
- `npm run test:server-smoke` — `SERVER_SMOKE=PASS` на живом Node HTTP server после добавления camera-key guard.

## Расширенные результаты финальной сверки

После первичного прогона дополнительно подтверждены следующие гейты:

- `test:tool-receipt-causal-workpass43` — 9/9 PASS.
- `test:workpass44:evidence-replay` — PASS: unknown-vs-contradicted, exact-ID external evidence, replay/restore, temporal credit, trust/observer/P83/P84, retired receipt fail-closed.
- `test:workpass44:action-crash` — PASS: pre-effect persistence gate, post-effect pending reconciliation, finalizer/commit failure, restart replay and conflicting-key refusal.
- `test:release-contract-alignment-workpass45` — PASS, runtime 35.66.0 / schema 225.
- `test:memory-retrieval-benchmark` — PASS as a benchmark run, but `recallDelta=0`; promotion remains `not-promoted`.
- `test:app:scripts` — 218/218 PASS; `test:browser-smoke-verdict` — 51/51 PASS (contract logic only, not real browser E2E).
- `audit:server-imports` — 11 checked, no missing imports; `audit:ui-api-linkage` — 125 routes / 49 runtime surfaces / no required seams missing; `audit:assets` — zero errors.
- `check:compacted-source-archives` — 8,512/8,512 members; `check:historical-snapshot` — 10,427/10,427 entries and 18,935 content-source references; `test:historical-path-restoration` — 4/4 PASS.
- `test:provenance-workpass45` — 1/1 PASS; SBOM contains 464 locked npm components, 8 embedded/source archives and 4 archives with license evidence (this is provenance, not legal sign-off).
- `audit:release-metadata` — 34/34 PASS; `test:release-metadata-contract` — 6/6 PASS; runtime typecheck, smoke, restart persistence and live-server smoke all PASS in standalone runs.

Preserving prior source history required another deliberate step: the three active camera-related source files changed in WorkPass45, so five historical snapshot references were rebound to immutable SHA-256 blobs rather than pointing at the new active bytes. This keeps historical versions exact while allowing current code to evolve. No original source files were deleted.

The longer sequential `audit:workpass45:reconciliation` run completed all preceding suites but hit the tool execution time limit during its final typecheck phase. Since the full command did not exit successfully, **no aggregate-audit PASS is claimed**; the typecheck and component gates were independently run and passed. The installed Vite production build, interactive browser/Live2D E2E and physical camera/provider tests remain unrun for the reasons below.

## Что ещё не сделано и почему

### P0 — устройство и внешние провайдеры

Termux camera adapter не может авторитетно доказать, что камера ничего не сделала после исчезнувшей квитанции. Нужна platform/device operation ID и источник, который хранит/отдаёт окончательный receipt; если это невозможно, правильное состояние остаётся `unknown` и нужна ручная сверка. Аналогично, Generic ActionGateway reconciliation становится доказательством только когда конкретный внешний API выполняет запрос с переданным idempotency token и отдаёт авторитетный receipt. Необходимо проверить accepted → disconnect → process restart → lookup → external observation → exact CEF evidence → reafference/temporal credit, включая crash points.

### P1 — приложение и runtime

Необходимо поставить pinned app dependencies в сетевом окружении, выполнить Vite production build, запустить настоящий desktop/mobile browser и проверить chat/diagnostics, модель Live2D, legacy sprite fallback, iframe message origin/source/schema rejection, восстановление и upgrade. HTTP smoke не проверяет визуальное отображение, интерактивные события и фактическую загрузку всех ресурсов в реальном браузере.

### P1 — память/провайдер

Внешний local model provider (llama.cpp) требует фактического inference на целевом хосте, latency/RAM, streaming/cancel и проверку качества. Retrieval-кандидат Chroma/FAISS не продвигать: существующий measured recall uplift 0; нужен независимо размеченный temporal holdout против BM25/лексического baseline.

### P1 — эксплуатация/лицензии

Остаются clean-room install/upgrade/backup/restore с failpoint rollback, multi-hour soak, измеримые memory/resource budgets и ручная проверка лицензий вложенных source projects. Автоматический SBOM фиксирует происхождение, но не заменяет юридическое заключение.

## Остаток полезных исходников из 4 внешних архивов

Полная пофайловая матрица — `docs/SOURCE_INTEGRATION_REMAINDER_WORKPASS45.csv` (22 записи, с внешним архивом, целью интеграции, state, критерием принятия и тем, чего нельзя переносить). Ключевые группы:

- WILL: замкнуть реальное delayed reafference/temporal-credit по авторитетному внешнему результату.
- Lumina: staged toolmaker approval, idle consolidation/dreaming, temporal decay; адаптация к текущим MemoryFabric/ActionGateway.
- Hexis/Mem0: memory supersession/revert/provenance и entity merge/conflict — только через MemoryOS2/MemoryFabric.
- Microsoft Agent Framework/OpenAI Agents SDK: typed middleware, guardrails, handoff/resume — только если есть измеримый gap в существующем gateway.
- OpenClaw/Hermes: pairing/auth/session resume/channel lifecycle/tool approval/device permission — file-level review, не массовое слияние.
- llama.cpp: реальный local inference и ресурсы на целевом устройстве.
- Chroma/FAISS: read-only retrieval experiment с отдельным holdout; никакого promotion без uplift.
- DSPy/Agent0/Hyperon: только sandboxed offline research.
- AutoGPT: лицензия-гейт; AutoGen/Langroid/OWL/PocketFlow — выборочные ссылки на паттерны.
- Два Letta ZIP — крошечные повторяющиеся snapshots: provenance, не новая capability.
- Superpowers — инженерный процесс, не runtime-функциональность.

## Итог

WorkPass45 существенно уменьшает вероятность повторного физического действия из-за повторного API-запроса, рестарта или неопределённого ответа и делает единственную точку исполнения камеры проверяемой. При этом он не маскирует пределы локальной квитанции и не приписывает Android/Termux гарантию, которую платформа не предоставляет. Официальный weighted release score остаётся 78.0%; pass-specific implementation progress — 85/100. Это разные показатели.
