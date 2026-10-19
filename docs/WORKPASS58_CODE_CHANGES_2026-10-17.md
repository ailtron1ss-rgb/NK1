# WorkPass58 — кодовые изменения (2026-10-17)

## Цель прохода

Закрыть разрыв между прямым вызовом инструмента и безопасным исполнением составного действия: preflight до первого side effect, сохранение decision lineage по шагам, согласованный approval/resume и невозможность объявить автономность только из публичного HTTP payload.

## Реальные изменения

### 1. `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts` — reusable skill executor

- До выполнения первого шага executor теперь собирает потенциальный маршрут исполнения: основной tool, допустимые learned-repair кандидаты и fallback tools.
- Нормализуется `android.capture_camera`; известные mutating/high-risk tools проверяются на необходимость durable idempotency.
- Parent idempotency key отсутствует или неверен — весь skill fail-closed до первого вызова; ошибка возвращает `idempotencyRequired`, `outcomeClass` и список инструментов, требующих ключ.
- Валидный parent key детерминированно порождает ключ каждого шага из parent key, skill ID, step ID и attempt. Это делает replay привязанным к исходной операции, а не к случайному повторному tick.
- Передаются стабильный per-step `decisionId`, ожидаемые output keys и только host-supplied autonomous context. Finalization получает реальный resolved input/options/reason, а не пустой объект.

### 2. `OrganismCore.executeProjectTool()` — project executor

- Проверка инструмента, allowlist/capability и обязательного idempotency key проходит до списания project budget и любого execution.
- Для mutation без корректного ключа возвращается preflight error; бюджет не списывается.
- Создаётся устойчивая decision identity из project ID, planned step, tool ID и idempotency key; нормализованные options распространяются на gateway/approval/resume, чтобы fingerprint и receipt lineage не расходились.

### 3. `runtime/neuro-kurisu/src/server/server.mjs` — публичные API границы

- `/api/organism/projects/tool` и `/api/organism/projects/step` не доверяют `input.autonomous === true`, пришедшему от клиента. Происхождение — host policy, не self-asserted API параметр.
- Skill/project route явно сообщает `idempotencyRequired` и не маскирует preflight отказ как успешное выполнение.
- HTTP server syntax check проходит. Реальный deployment-origin/browser тест остаётся отдельным release gate.

### 4. Новый интеграционный тест

`runtime/neuro-kurisu/tests/workpass58-composite-idempotency-preflight.mjs` запускает настоящий `OrganismCore` на контролируемых инструментах и проверяет:

- составной skill с safe read первым шагом и mutating вторым без parent key не вызывает ни один инструмент;
- keyed run создаёт два receipts и stable per-step decision IDs;
- повтор той же операции повторно не выполняет side effect;
- project path отказывает до списания бюджета;
- заданные project decision ID и доверенная autonomous attribution доходят до receipt.

### 5. Стабильность существующего regression test

`tests/memory-background-index-workpass56.mjs` больше не полагается на фиксированный sleep для доказательства single-flight сериализации. Deferred provider barrier удерживает известную in-flight операцию, пока второй consumer подключается к ней. Это исправляет гонку в тестовом сценарии и сохраняет смысловую проверку конкуренции; это не считается улучшением качества поиска само по себе.

## Release metadata / совместимость

- Runtime: `35.78.0`, schema остаётся `225`. Согласованы runtime `package.json`/lock, `VERSION.json`, `RELEASE_MANIFEST.json`, `ReleaseContract.ts` и root `SUPER_VERSION.json`.
- `test:workpass58` запускает runtime typecheck и оба focused WorkPass58 теста. Полный унаследованный regression suite выполняется отдельно командой `test:workpass57`; root `audit:workpass58` включает обе команды и сохраняет app script, browser-smoke, memory benchmark, server/UI linkage, quick audit и metadata gates.
- Runtime `RELEASE_ARCHIVE_MANIFEST.json` пересоздаётся после окончательных изменений.

## Проверки и честная граница результата

- Runtime TypeScript compiler: PASS.
- `test:workpass58-composite-preflight`: PASS.
- `test:workpass57` при отдельном запуске: PASS, включая receipt integration 9/9, provider reconciliation (5 сценариев), crash/replay, memory indexing и privacy.
- Независимый retrieval uplift не получен: `recallDelta=0`; кандидат не promoted.
- Производственный browser E2E, реальные provider/device postconditions и restart/reconcile не заявляются проверенными.

### 6. HTTP preflight semantics — malformed key versus missing key

- Новый `src/server/idempotency-response.mjs` централизованно отображает canonical preflight result: некорректный явно переданный ключ (`idempotency-key-invalid`) даёт HTTP 400; отсутствие обязательного стабильного ключа даёт HTTP 428; прочие исходы остаются за политикой endpoint.
- `server.mjs` использует общий helper на skill execute, project tool и project step endpoints.
- Новый `tests/workpass58-idempotency-http-status.mjs` покрывает 400/428 и проверяет, что обычные исходы не переписываются helper-ом.
