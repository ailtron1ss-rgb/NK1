# WorkPass59 — code change inventory

## Центральная граница action → outcome

- `runtime/neuro-kurisu/src/organism/system/ActionGateway.ts`: экспортирован `wasToolExecutorEntered`. Только `execution-failed`, `executed-unverified`, `executed-verified` и `executed-contradicted` означают, что управление вошло в registered tool executor. Предисполнительные статусы не считаются side effect.
- `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts`: `finalizeToolOutcome` теперь возвращается до `OutcomeCognition.project`, causal action/outcome projection, external trust и обучения для предисполнительных исходов. Сам факт отказа/недоступности сохраняется в `ActionGateway` audit snapshot. Авторитетный `reconciled-not-executed` получает отдельный CEF reconciliation event без action/outcome competence projection.

## Защита когнитивного обучения

- `executeReusableSkill`: счётчик свежих исполнений увеличивается только для фактически вошедшего в executor результата. Результат preflight gate вызывает явное pause event и checkpoint, не пишет repair и не записывает aggregate success/failure. Полный replay возвращается как `idempotentReplay=true` только когда нет нового исполнения и нет заблокированного шага.
- `executeProjectTool`: `AutonomousProjectExecutor.observeToolResult` и `skillAcquisitionBenchmark.observe` вызываются только после входа в исполнитель; предисполнительные блоки отображаются событием `project-tool-preflight-blocked`.

## Регрессии

- `tests/workpass59-preexecution-outcome-firewall.mjs`: approval, unavailable, policy-refused и ambiguous receipt не создают ложные action/outcome nodes; executor failure после реального входа по-прежнему создаёт ровно одну запись/связи причинности.
- `tests/workpass59-nonexecution-learning-firewall.mjs`: недоступность инструмента не приводит к repair/aggregate skill penalty, project failure attempt или отрицательному benchmark sample.

## Результат и ограничения

Две регрессии и TypeScript typecheck проходят. Объединённый `test:workpass58` превысил лимит времени, но оба составляющих WorkPass58 теста прошли при отдельном запуске. Дополнительно отдельно прошли WorkPass57 outcome hardening, causal index, idempotency policy, crash reconciliation, receipt integration 9/9 и provider reconciliation 5 scenarios. Наблюдение/проверка внешней среды, которая реально переживает process restart, остаётся необходимой перед подтверждением end-to-end качества. Список релизных ворот — в `ROADMAP_GAPS_TO_TARGET_WORKPASS59.md`.
