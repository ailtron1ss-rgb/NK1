# WorkPass328 — deterministic transient approval retry

**Дата:** 2026-10-25  
**Ветка:** `fix/cognitive-interrupt-severity-normalization-2026-10-25`  
**Проверенный head:** `9d0e1fa5d7cb94e0e252cce09bdfca4551d0ddba`  
**CI:** Unified project integration suite #55, run `40229436759`, conclusion **success**  
**PR:** [#135](https://github.com/ailtron1ss-rgb/NK1/pull/135)

## Задача

WorkPass326/327 исправили transient checkpoint contention, определили bounded HTTP retry и согласовали timeout research bridge. Чтобы не полагаться только на end-to-end поведение при отсутствии реальной гонки в каждом запуске, алгоритм был вынесен в отдельный модуль и проверен детерминированными часами и sleep callback.

## Изменения

- Добавлен `runtime/neuro-kurisu/src/server/transient-approval-storage-retry.mjs`.
- `server.mjs` импортирует helper и использует его в permission request/resolve/consume маршрутах, передавая общий ограниченный retry budget.
- Helper повторяет только результат, распознанный точным predicate вызвавшего кода. Постоянная ошибка хранения возвращается сразу; неожиданные исключения не маскируются.
- После deadline следующая попытка больше не запускается. В тесте используется управляемый clock и sleep, чтобы проверка была воспроизводимой без настоящей задержки.
- Новый `tests/workpass327-transient-approval-retry.mjs` включён в `test:workpass53` и запускается unified workflow.

## Регрессионные сценарии

1. Три transient busy ответа, затем успешная операция.
2. Deadline исчерпан: задержки `[25, 50, 15]` мс, третья попытка является последней, после дедлайна новая операция не стартует.
3. Permanent `approval-storage-failed` не повторяется.
4. Исключение операции пробрасывается сразу.

CI marker: `WORKPASS327_TRANSIENT_APPROVAL_RETRY=PASS scenarios=4`.

## Подтверждённый результат integration workflow #55

- Node 24 pin, Python 3.12, CPU-only torch install + `pip check`: PASS.
- Canonical installer, environment doctor, обе locked npm workspace установки и supervisor tests: PASS.
- App build/typecheck и runtime typecheck: PASS.
- Cognitive integration contracts: PASS; raw telemetry → routing test `COGNITIVE_FRAME_CRITICAL_INTERRUPT=PASS scenarios=6 routeClosed=true`.
- Approval boundary: `WORKPASS53_ACTION_APPROVAL_BOUNDARY=PASS scenarios=25`.
- Research bridge contract and timeout: `WORKPASS53_RESEARCH_BRIDGE_APPROVAL=PASS scenarios=10`.
- Real runtime ↔ bridge approval E2E: `WORKPASS53_APPROVAL_BRIDGE_E2E=PASS scenarios=20`.
- Unified research smoke: unapproved NeuroCore/NOMEGA/DeepCode calls return 403; explicit approval then allows each probe. NeuroCore MSE delta `-0.8120256662368774`; NOMEGA registry scans 313 modules with 0 cycles; DeepCode CPU smoke passes.

## Interpretation and remaining gates

Это подтверждённое прохождение полного integration smoke на указанном source head, а не заявление о завершённом production/release проекте. Остаются real browser/UI + Live2D/TTS, Android/Termux audio, независимые held-out retrieval/learning-transfer measurements, длительный soak, license review и воспроизводимость релизного ZIP на чистой машине. Ветка не была слита в main, релизный asset не менялся.
