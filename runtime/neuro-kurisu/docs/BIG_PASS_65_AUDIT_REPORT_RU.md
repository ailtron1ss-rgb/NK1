# NEURO-KURISU — BIG PASS 65: Reality Reconciliation

Дата: 2026-09-06
Релиз: **34.36.0**
Schema: **98**

## Цель
Усилить BIG PASS 64 без создания нового физического P-модуля: объединить независимые внешние наблюдения, верификацию исходов и PredictionLedger в единый epistemic/reality-контур.

## Что изменено

### 1. Independence-aware reconciliation
`ExternalObserverFabric` теперь строит `RealityClaimReconciliation`. Вклад источников сначала группируется по `independenceKey`, поэтому дубли одного канала не создают ложный quorum.

Статусы: `corroborated`, `supported`, `disputed`, `unknown`.

### 2. Dynamic freshness
При оценке используется фактический возраст observation, а не сохранённый на момент записи `freshness01`. Старое наблюдение поэтому естественно теряет силу.

### 3. Prediction closure
Observation может содержать `predictionId`. После `match`/`mismatch` Core автоматически разрешает соответствующий PredictionLedger и PredictionDebt. `unknown` специально не закрывает prediction debt.

### 4. Grounded-world gate
`worldContextAfter` теперь передаётся в World Fabric только при `verified`, `supported` или `corroborated`. Это снижает риск превращения неподтверждённого внешнего сигнала в мировую истину.

### 5. API
Добавлен штатный reconcile endpoint: `/api/organism/external-observer/reconcile`.

### 6. Persistence repair
При перепроверке обнаружено, что migration projection не переносила `system.predictionLedger`, из-за чего prediction мог исчезать после restart. Это исправлено.

## Проверки
`TYPECHECK=PASS`
`BIG_PASS_65_REALITY_RECONCILIATION=PASS`
`BIG_PASS_65_AUDIT=PASS`
`BIG_PASS_64=PASS`
`BIG_PASS_64_ADAPTERS=PASS`

## Ограничения
1000-cycle operational qualification теперь PASS в текущем test environment. Отдельная реальная квалификация на физическом Android/Termux всё ещё не проведена. 220-cycle scaling benchmark в текущем прогона имеет WARNING по ratio.
