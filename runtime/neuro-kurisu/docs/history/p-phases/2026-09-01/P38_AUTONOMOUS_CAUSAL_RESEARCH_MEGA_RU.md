# P38 — Autonomous Causal Research Mega Pack

## Практический эффект
P38 превращает самостоятельное развитие из «гипотеза → sandbox-оценка» в управляемый исследовательский цикл: организм обнаруживает дефицит, формирует гипотезу, проектирует безопасное model-based вмешательство, проводит детерминированный контроль/тreatment прогон, требует репликации для принятия изменения, сохраняет отрицательные результаты и применяет подтверждённый behavioural update только после успешного research-gate.

## Что реально реализовано
- Автоматический выбор research area на основании prediction error, uncertainty, self-error, sensor conflict, agency и resource pressure.
- Структурированные hypotheses с evidence/provenance.
- Deterministic sandbox trials; случайный шум из научного протокола исключён.
- Control/treatment сравнение на существующих предсказаниях организма с тремя детерминированными репликами внутри sandbox.
- Replication gate: слабый эффект или несогласованные реплики не принимаются как improvement.
- Только replicated result может изменить P38 action bias.
- Evidence уровня `sandboxed-replicated` хранится отдельно от наблюдений.
- Ограниченный research budget и восстановление бюджета по циклам.
- Bounded history гипотез, trials и evidence.
- P38 встроен в decision loop, поэтому принятый research result влияет на последующие решения.
- P38 сохраняется в persistent learning facet и мигрирует через schema 40→41.
- Server API позволяет наблюдать, предлагать и запускать sandbox experiment явно.

## Что намеренно НЕ утверждается
P38 не является физическим причинным экспериментом во внешнем мире. Его current trial metric — model-based predicted action utility. `independent=false` для текущих sandbox trials: три реплики получают детерминированно изменённые контексты, но не являются независимыми внешними наблюдениями. Для external causal claim нужны реальные вмешательства, независимые среды/выборки и независимый evaluator.

## Научный принцип
Одинаковый persisted state + одинаковый experiment seed/condition должен давать один и тот же результат. Поэтому случайный шум исключён из trial equation.

## Защита от ложного обучения
- неуспешная репликация сохраняется как отрицательный результат;
- отклонённый trial не меняет action bias;
- budget ограничивает частоту экспериментов;
- hypotheses/trials/evidence bounded;
- learned result должен пройти следующий внешний/holdout gate, прежде чем его можно считать доказанным долговременным улучшением.

## Следующий усиленный уровень
P39 должен добавить настоящий экспериментальный sandbox с несколькими независимыми средами/ветвями, long-horizon trajectories, multi-seed replication, confidence intervals и automatic regression/rollback по длительным данным.
