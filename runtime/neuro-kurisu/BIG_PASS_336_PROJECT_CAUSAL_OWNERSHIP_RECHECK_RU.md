# BIG PASS 336 — Project Causal Ownership Recheck

Дата: 14 сентября 2026

## Почему B336

Перепроверка B335 показала, что его holdout gate измерял transfer/retention, но не доказал причинное влияние project state на action selection. Более того, сам B335 harness вручную переключал baseline/training/holdout, поэтому это controlled gate, а не полностью endogenous live lifecycle.

B336 не создаёт новую project систему. Он измеряет уже существующий project contribution внутри canonical action candidate pipeline и добавляет lesion-style comparison: тот же candidate set с project-specific contribution и без него.

## Реальное изменение

В `OrganismCore` выделен project contribution:

`projectInfluence + projectActionBias + projectExecutor.bias(...)`

Для каждого candidate сохраняются full raw utility, project-ablated raw utility и project contribution. Это позволяет увидеть, меняет ли удаление project-specific influence ранжирование действий.

## Unit result

PASS:
- 3 project-active observations;
- 3 ablation comparisons;
- mean project contribution > 0;
- top action changes on every controlled observation;
- `explore -> rest` under project lesion;
- gate eligible = true.

## Real Core result

Real Core short-run B336 harness не завершился в текущем local execution budget.

Статус: `CORE REPRODUCTION = OPEN`.

Timeout НЕ считается PASS.

Следовательно, нельзя утверждать, что organism-level causal ownership уже воспроизведён на полном live Core цикле.

## Что B336 доказывает

`project state -> project-specific decision contribution -> action ranking can change` на controlled unit level.

## Что B336 НЕ доказывает

- что организм сам генерирует и удерживает проект без harness;
- что project contribution вызывает реальное внешнее consequence;
- что эффект сохраняется на long horizon;
- что внешний мир, а не внутренний simulator, подтверждает ownership;
- Android/Termux embodiment.

## Архитектурный эффект

Это первый шаг от B335 transfer-only measurement к измерению конкретного causal seam внутри `OrganismCore`. Следующая задача — вынести seam в стабильную `Decision/Action Pipeline` boundary и добиться воспроизводимого короткого Core run.

## Регрессии

- runtime typecheck: PASS
- B336 unit causal ownership: PASS
- B335 live Core: OPEN / no fresh PASS
- long-horizon Core: OPEN

## Progress

Общая оценка остаётся около 73/100. B336 не увеличивает процент автоматически: ценность этапа — в измеримом causal seam и обнаруженном scalability bottleneck Core.
