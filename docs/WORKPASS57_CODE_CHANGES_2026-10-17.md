# WorkPass57 — фактические изменения кода

**Дата:** 17 октября 2026 года  
**Исходная база:** `Neuro_Kurisu_WORKPASS56_2026-10-17.zip`  
**Runtime:** `35.77.0` · **persisted schema:** `225`  
**Статус:** implementation workpass, не релизное одобрение.

## Суть прохода

WorkPass57 закрывает конкретные разрывы на стыке исполнения, внешнего подтверждения, причинного следа и обучения. Это не новая параллельная архитектура: изменения остаются внутри существующих `ActionGateway`, `OutcomeVerificationService`, `OutcomeCognitionFabric`, `CausalAccountabilityGraph`, `ExternalObserverFabric`, `OrganismCore` и текущего state-migration pipeline.

## Кодовые изменения

### 1. Результат действия перестал приравниваться к ответу инструмента

- `OutcomeVerificationService.ts`: внешняя evidence-запись с `basis: tool-contract` отклоняется; для внешней проверки обязательны валидный `observationId` и ограниченные `expectedPostcondition`/`observedPostcondition`.
- `ActionGateway.ts`: добавлен отдельный исход `executed-contradicted`. Если исполнитель ответил положительно, но точный внешний postcondition противоречит ожидаемому, исход действия теперь `ok:false`, `verified:false`; это не маскируется под успех.
- `OutcomeCognitionFabric.ts`: то же правило повторно выполняется на границе причинной проекции; неверно подписанное доказательство не может попасть в причинный граф как verified external.
- `causalAutobiography()` теперь отображает прямое подтверждённое противоречие как `externally-contradicted`, а не как «ожидающее подтверждения».

### 2. Durable idempotency выводится из класса операции

- `ActionGateway.ts`: обязательность стабильного ключа определяется по флагам, destructive-классу, семантическим токенам действия и inferred capability/permission-классу. Старые tool-регистрации для записей в filesystem, устройств, code/process, system и self-modification больше не могут полагаться лишь на отсутствующий `requiresIdempotencyKey`.
- Неключевая операция, классифицированная как изменяющая состояние/высокорисковая, отклоняется до входа в executor. Read-only пути остаются без лишнего ключевого требования.
- Существующие approval tickets, durable pending receipt, один исполнитель и replay-guard сохранены; второй слой исполнения не добавлялся.

### 3. Причинность переживает вытеснение кольцевой истории

- `OutcomeCognitionFabric.ts`: введён ограниченный persisted `projectionIndex` на `executionId` с fingerprint. Идентичный replay возвращает предыдущую проекцию; тот же ID с изменённым результатом отклоняется конфликтом.
- `CausalAccountabilityGraph.ts`: добавлен ограниченный `outcomeIndex`, позволяющий точно восстановить узел исхода для позднего наблюдения после вытеснения из недавнего окна. Индекс сохраняется/восстанавливается вместе с causal snapshot.
- `StateMigrations.ts` и `OrganismCore.ts`: индексы и provenance внешних наблюдений проходят через сохранение и миграцию; лимиты размера и полей сохраняются. Неоднозначный или неизвестный результат по-прежнему не порождает отрицательный кредит.

### 4. Обучение стало строже привязано к происхождению доказательства

- Удалены прямые назначения learning credit из одного gateway/tool результата, включая прямое противоречие без lineage внешнего источника. Сохраняется prediction-error/verification trace, но это не равно изменению компетентности.
- `ExternalObserverFabric.ts`: ясное противоречие конкретного поля/значения больше не теряет оценку уверенности только из-за низкой similarity; неоднозначное семантическое расхождение остаётся `unknown`.
- `OutcomeCognitionFabric.ts`: запись внешнего наблюдения хранит `sourceId`, `sourceClass`, `independenceKey` и категорию assessment. Источник должен принадлежать разрешённому внешнему классу и достигать порога уверенности.
- Для положительного learning требуется идентифицированный источник с независимым ключом и достаточной уверенностью. Для отрицательного learning необходимо минимум два разных `independenceKey` с достаточно уверенными явными противоречиями. Два сервиса, использующие одну линию происхождения, не считаются независимыми.
- Неизвестные и неподтверждённые observations сохраняются для accountability, но не назначают компетентностный кредит.

### 5. Архитектурный audit перестал ошибочно считать cross-package import потерянным

- `scripts/audit-architecture.mjs`: включён анализ соседних `app/src`, `app/scripts` и `app/server` для проверки интеграционных импортов; учтены TSX/JSX и query-bearing asset imports. Устаревшие legacy directories исключаются из исполняемого графа.
- После изменения аудит архитектуры проходит: `CLEAN_ARCHITECTURE=PASS sourceFiles=1998 canonicalFiles=582 missing=0 cycles=0 legacyLeakage=0`.

### 6. Тесты и команды WorkPass57

Новые тесты:

- `tests/workpass57-action-idempotency-policy.mjs`
- `tests/workpass57-outcome-causality-index.mjs`

Уточнены:

- `tests/big-pass-129-outcome-verification-hardening.mjs`
- `tests/big-pass-63-outcome-cognition-fabric.mjs`
- `tests/big-pass-380-evidence-and-retired-receipts.mjs`
- сценарии согласования approval в `big-pass-379/380/381`.

Добавлена команда `npm run test:workpass57`, включающая TypeScript typecheck, hardening внешней верификации, ключевую idempotency policy, поздние receipts/миграции, crash/reconciliation, 9 receipt-integration сценариев, 5 provider-reconciliation сценариев и WorkPass56 memory-index/privacy regressions.

## Проверенные результаты этого прохода

- `npm run typecheck` — PASS (`tsc`).
- `npm run test:workpass57` — PASS по всем включённым сценариям.
- `npm run audit:architecture` — PASS: 1998 индексированных исходников, 582 canonical files, 0 missing imports, 0 cycles, 0 legacy leakage.
- `npm run audit:hygiene` — PASS: 4024 файла, 0 errors, 0 warnings.
- `npm run audit:contract` — PASS.
- `npm run audit:integrity` — PASS: 4030 файлов, согласованный runtime/schema.
- `npm run audit:syntax` — PASS: 1343 JS, 6 shell, 247 JSON, 0 parser failures.
- `node scripts/verify-release-source.mjs` — PASS для runtime `35.77.0`, core `100.32.0-r26-hierarchical-lowrank-causal`, schema `225`.

## Что этим не доказано

Этот проход не подтверждает наличие сознания, не доказывает полный реальный цикл обучения на физическом устройстве и не объявляет релиз готовым. В тестах нет живого production provider/device соединения. Сохранены открытыми: production Vite/browser/Live2D E2E, external postconditions на настоящем провайдере/устройстве, аудио/фонемы, независимый memory-retrieval uplift (сейчас `recallDelta=0`), clean-room rollback, полная проверка лицензий nested sources и длительный soak. Официальная взвешенная дорожная карта остаётся **78.0%**.
