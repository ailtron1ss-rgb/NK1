# Neuro Kurisu — сводный инженерный отчёт WorkPass57

**Дата:** 17 октября 2026 г.  
**Входная база:** `Neuro_Kurisu_WORKPASS56_2026-10-17.zip`  
**Результирующая версия:** `Neuro_Kurisu_WORKPASS57_2026-10-17.zip`  
**Runtime:** `35.77.0` · **core:** `100.32.0-r26-hierarchical-lowrank-causal` · **persisted schema:** `225`  
**Статус:** implementation workpass; это не подтверждение готовности релиза.

## 1. Итог прохода

WorkPass57 укрепляет критический участок целевого цикла: **решение → разрешение → исполнение → квитанция → внешняя проверка → причинная проекция → ограниченное обучение**. Код остаётся в имеющихся канонических владельцах; не добавлялся второй runtime, второй writable memory store или второй шлюз действий.

Ключевые изменения не сводятся к наличию новых тестов: теперь инструментальный ACK не может быть повышен до независимого подтверждения внешнего состояния; явное противоречие ожидаемого и фактического postcondition остаётся отдельным исходом; операции с побочным эффектом требуют устойчивой идемпотентности даже при неполных старых описаниях tools; поздние наблюдения связываются по устойчивому execution ID после ротации недавнего окна; обучение требует проверяемого происхождения и независимости доказательств.

## 2. Изменения в runtime-коде

### 2.1 Внешняя верификация и честный outcome

- `src/organism/system/OutcomeVerificationService.ts`: введён общий assessment внешнего postcondition; `basis: tool-contract` не считается независимым внешним наблюдением. Для подтверждения требуются bounded `observationId`, ожидаемое и наблюдаемое состояния.
- `ActionGateway.ts`: явное противоречие возвращает `executed-contradicted`, `ok:false`, `verified:false`; неоднозначный результат не выдаётся за успех.
- `OutcomeCognitionFabric.ts`: проверка повторяется на границе причинной проекции, чтобы неправильную запись нельзя было протащить через обходной caller.
- `OrganismCore.ts`: causal autobiography различает подтверждённое внешнее противоречие от просто ожидающего проверки результата.

### 2.2 Единая политика идемпотентности

`ActionGateway.ts` теперь выводит необходимость durable idempotency не только из `requiresIdempotencyKey`, но также из семантики действия, его destructive/risk class и capability/permission profile. Запись в filesystem, device mutation и другие потенциально изменяющие состояние пути не могут неявно обойти устойчивый ключ только потому, что старый tool registration не выставил опциональный флаг. Ключевая проверка выполняется до входа в executor. Read-only вызовам не навязывается лишняя мутация-семантика.

### 2.3 Поздние receipts, snapshots и replay

- `OutcomeCognitionFabric.ts`: добавлен ограниченный persisted `projectionIndex`, связывающий `executionId` с fingerprint. Повтор того же receipt идемпотентен; тот же ID с иным содержимым даёт конфликт.
- `CausalAccountabilityGraph.ts`: добавлен устойчивый bounded `outcomeIndex`; позднее observation может найти правильный узел после eviction из recent ring. Индекс входит в сохранение/восстановление.
- `StateMigrations.ts` и `OrganismCore.ts`: сохраняются assessment, `sourceId`, `sourceClass`, `independenceKey` и новые индексы в пределах лимитов. Обновление схемы не должно незаметно терять lineage внешнего доказательства.

### 2.4 Обучение с provenance-gating

Внешние наблюдения сохраняются как accountability/prediction-error evidence независимо от того, разрешено ли по ним учиться. Но отсутствие/неоднозначность данных, policy refusal, инструментальный ACK или единственный источник противоречия не должны менять компетентность навыка.

- Положительный credit требует разрешённого класса внешнего источника, source identity/independence key и уверенности выше принятого порога.
- Отрицательный credit от противоречия требует как минимум двух действительно различных independence keys, допустимых источников и достаточной уверенности. Повторные наблюдения одной provenance-линии не засчитываются как независимые.
- `ExternalObserverFabric.ts`: конкретное сильное расхождение одного и того же поля больше не получает искусственно низкую уверенность только из-за слабого текстового сходства; неоднозначное смысловое расхождение остаётся `unknown`.

### 2.5 Архитектурный аудит и релизная согласованность

`scripts/audit-architecture.mjs` теперь учитывает межпакетные импортируемые источники `app/src`, `app/scripts`, `app/server`, TSX/JSX и импорты assets с query-параметрами; legacy-каталоги не смешиваются с исполняемым графом. Это устраняет ложные missing-import сигналы и сохраняет возможность видеть реальные разрывы.

Синхронизированы корневые WorkPass-метаданные, `SUPER_VERSION.json`, root `package.json`, runtime `VERSION.json`, `RELEASE_MANIFEST.json`, `ReleaseContract.ts`, changelog и текущий список дел. Добавлены root-команды `test:workpass57` и `audit:workpass57`. Удалено не относящееся к стандартной схеме поле `scripts` из runtime lockfile; сами lockfile-зависимости не перестраивались.

## 3. Новые/обновлённые проверки

Новые регрессионные наборы:

- `tests/workpass57-action-idempotency-policy.mjs` — inferred mutation classification, durable receipt, approval/replay и autonomous permission boundary.
- `tests/workpass57-outcome-causality-index.mjs` — точное противоречие, позднее evidence после eviction, migration/snapshot и replay dedupe.
- `tests/big-pass-129-outcome-verification-hardening.mjs` — fail-closed external evidence contract.
- `tests/big-pass-63-outcome-cognition-fabric.mjs` — причинная проекция и provenance-gated learning.
- `tests/big-pass-380-evidence-and-retired-receipts.mjs` и обновлённые fixtures интеграционных сценариев approval/receipt.

Команда `npm run test:workpass57` включает TypeScript typecheck; outcome hardening; классификацию idempotency; bounded outcome index; crash/replay/reconciliation; 9 receipt integration scenarios; 5 provider reconciliation scenarios; а также ранее существующие memory index/privacy tests.

## 4. Проверенные результаты

| Проверка | Фактический результат |
|---|---|
| Root release metadata | 34/34 PASS |
| Release metadata contract tests | 6/6 PASS |
| WorkPass57 runtime suite + typecheck | PASS |
| Receipt integration | 9/9 PASS |
| Provider reconciliation scenarios | 5/5 PASS |
| App-script tests | PASS |
| Browser-smoke contract tests | 51/51 PASS |
| Atomic browser report writer | 4/4 PASS |
| Server-relative imports | 11 checked, 0 missing |
| UI/API linkage | 130 client routes, 49 Runtime Atlas surfaces, 5/5 required seams, no missing handlers/proxies |
| Architecture audit | 1998 indexed source files; 582 canonical files; 0 missing imports, cycles or legacy leakage |
| Source hygiene | 4024 files, 0 errors, 0 warnings |
| Integrity | 4030 files, aligned runtime/core/schema |
| Executable syntax | 1343 JS, 6 shell, 247 JSON; 0 parser failures |
| Live2D asset audit | 0 errors; 21 app mirrors byte-identical to canonical assets |
| Runtime archive manifest | 4243 files; 0 missing, 0 hash mismatch, 0 extras |
| Release source | PASS for runtime 35.77.0/core 100.32.0-r26-hierarchical-lowrank-causal/schema 225 |

Отдельные browser-smoke tests проверяют контракт verdicts/guards/report paths; это **не** заменяет production Vite build или настоящую браузерную сессию. Аналогично simulated provider/reconciliation tests не подтверждают реальный внешний side effect на подключённом физическом устройстве.

## 5. Память: честный результат benchmark

`big-pass-126-memory-retrieval-benchmark.mjs` выполнен: corpus=18, train=4, holdout=8, 400 bootstrap samples. Получено `recallDelta=0`, CI lower/median/upper = 0, решение `promotion=not-promoted`, reason `recall-uplift-below-threshold`. Candidate не продвигается. WorkPass57 **не заявляет улучшение retrieval quality**; изменения здесь касаются provenance/сохранения outcome, а уже существующая индексация остаётся оптимизацией без доказанного uplift качества.

## 6. Сохранность исходного архива

Хеш-сравнение распакованного содержимого показало: **9 205 файлов байт-в-байт неизменны, 29 существующих файлов изменены, 9 файлов добавлены, 0 исходных файлов отсутствуют**. Все 9 234 исходных ZIP paths сохранены. Девять новых файлов WorkPass57 — отчёты/статусные документы и два специализированных теста. Итоговый ZIP содержит 9 243 файловых элемента; UTF-8 имена и CRC проверены, а точное сравнение путей не выявило пропусков. Исторические материалы и прежние версии массово не удалялись: доказанной безопасной миграции/замены для такого удаления не проводилось. Runtime archive manifest пересоздан и проверен отдельно.

## 7. Что всё ещё не закрыто

1. Исчерпывающая матрица всех исполняемых `executeTool`/provider/device/research/voice/outbound call sites: проверить один decision/execution ID, approval для точного input, durable pending receipt, один finalizer, reconciliation и causal projection на каждом маршруте.
2. Реальный provider/device read-after-write E2E, включая отключение процесса после side effect до finalizer, рестарт и сверку без blind retry.
3. Установка app dependencies из канонического lockfile, production Vite build и browser E2E: approve/decline/expiry/reload/orphan/reconnect и UI/Live2D отображение истины receipt.
4. Независимый frozen retrieval holdout: recall/temporal correctness/false recall/abstention/latency и сравнение BM25/hybrid/vector. Текущий результат — нулевой uplift.
5. Тест на целевом локальном оборудовании: конкретная модель/quantization/context, память VRAM/RAM, throughput и качество. А также exact audio-buffer/phoneme/viseme synchronization, clean-room rollback и длительный soak.
6. Полная лицензия/provenance review всех nested upstream archives перед дальнейшей массовой интеграцией/удалением.

## 8. Статус и следующее действие

Официальная взвешенная дорожная карта остаётся **78.0%**, как указано в master roadmap: зелёные симулированные/контрактные тесты не дают основания повысить release readiness, пока production/browser/provider/device/rollback/soak gates остаются открыты. Следующий кодовый проход — инвентаризировать каждый исполняемый side-effect caller и замкнуть реальные provider/device postconditions, а не добавлять новые параллельные подсистемы.

Связанные документы:

- `docs/WORKPASS57_CODE_CHANGES_2026-10-17.md` — покомпонентная дельта.
- `docs/WORKPASS57_HANDOVER_2026-10-17.md` — передача следующего прохода.
- `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS57.md` — остаточные P0/P1/P2 gates.
- `docs/PROJECT_CURRENT_STATUS_2026-10-17_WORKPASS57.md` и `.json` — актуальная сводка статусов.
- `docs/PROJECT_PROGRESS_SCORECARD_2026-10-17_WORKPASS57.json` — взвешенная дорожная карта и отметки проверок.


## Приложение A. Полный индекс изменённых файлов

### Изменены 29 файлов, уже существовавших в WorkPass56

**Runtime outcome/action/learning:**
- `runtime/neuro-kurisu/src/organism/system/OutcomeVerificationService.ts`
- `runtime/neuro-kurisu/src/organism/system/ActionGateway.ts`
- `runtime/neuro-kurisu/src/organism/system/OutcomeCognitionFabric.ts`
- `runtime/neuro-kurisu/src/organism/system/CausalAccountabilityGraph.ts`
- `runtime/neuro-kurisu/src/organism/system/ExternalObserverFabric.ts`
- `runtime/neuro-kurisu/src/organism/system/AutonomousResourceToolLifeController.ts`
- `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts`
- `runtime/neuro-kurisu/src/organism/persistence/StateMigrations.ts`
- `runtime/neuro-kurisu/src/organism/system/ReleaseContract.ts`

**Тесты/инфраструктурная верификация:**
- `runtime/neuro-kurisu/tests/big-pass-129-outcome-verification-hardening.mjs`
- `runtime/neuro-kurisu/tests/big-pass-63-outcome-cognition-fabric.mjs`
- `runtime/neuro-kurisu/tests/big-pass-379-tool-receipt-integration.mjs`
- `runtime/neuro-kurisu/tests/big-pass-380-action-crash-reconciliation.mjs`
- `runtime/neuro-kurisu/tests/big-pass-380-evidence-and-retired-receipts.mjs`
- `runtime/neuro-kurisu/tests/big-pass-381-provider-reconciliation.mjs`
- `runtime/neuro-kurisu/scripts/audit-architecture.mjs`

**Release metadata, inventory and instructions:**
- `runtime/neuro-kurisu/package.json`
- `runtime/neuro-kurisu/package-lock.json`
- `runtime/neuro-kurisu/VERSION.json`
- `runtime/neuro-kurisu/RELEASE_MANIFEST.json`
- `runtime/neuro-kurisu/RELEASE_ARCHIVE_MANIFEST.json`
- `package.json`
- `SUPER_VERSION.json`
- `README.md`
- `CHANGELOG.md`
- `contracts/inventory/live-source-inventory.json`
- `docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md`
- `docs/Neuro_Kurisu_Список_дел_CURRENT.md`
- `Список дел.md`

### Добавлены 9 файлов

- `runtime/neuro-kurisu/tests/workpass57-action-idempotency-policy.mjs`
- `runtime/neuro-kurisu/tests/workpass57-outcome-causality-index.mjs`
- `docs/WORKPASS57_CODE_CHANGES_2026-10-17.md`
- `docs/WORKPASS57_HANDOVER_2026-10-17.md`
- `docs/WORKPASS57_IMPLEMENTATION_REPORT_RU.md`
- `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS57.md`
- `docs/PROJECT_CURRENT_STATUS_2026-10-17_WORKPASS57.md`
- `docs/PROJECT_CURRENT_STATUS_2026-10-17_WORKPASS57.json`
- `docs/PROJECT_PROGRESS_SCORECARD_2026-10-17_WORKPASS57.json`

Файлы вне этого перечня не изменялись по сравнению с распакованным содержимым WorkPass56. По полному SHA-256-сравнению: 9 205 старых файлов идентичны, 29 существовавших файлов изменены, 9 добавлены, 0 потеряны.
