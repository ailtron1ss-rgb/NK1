# Neuro-Kurisu 34.87.0 — BIG PASS 113

## Cognitive Substrate Consolidation

Цель прохода — не добавление очередного поверхностного P-модуля, а усиление причинных связей между уже существующими Self / World / Memory / Prediction / Resource системами.

### Реализовано

- Добавлен `OrganismResourceAllocator`: единый bounded allocator вычислительного ресурса с учётом battery/thermal/RAM, неопределённости, prediction error, целей, novelty и social demand. Он влияет на action scoring малым bounded signal и не заменяет governance.
- Добавлен `UnifiedCognitiveSubstrate`: единая производная cross-system проекция, связывающая self/world/prediction/resources/evidence без переноса canonical ownership.
- `OrganismCore` восстанавливает и сохраняет оба новых состояния; allocator реально участвует в выборе действий и substrate получает данные текущего cognition loop.
- Исправлена семантическая ошибка `WorldEnvironment`: отрицательные rewards больше не превращаются в положительные при сохранении перехода. Raw signed reward сохраняется отдельно от display-only 0..1 представления.
- Исправлен stale P34 migration test: он проверяет текущий schema contract 122, а не историческое значение 83.
- Исправлена воспроизводимая ошибка P38 replication gate: критерий значимости теперь привязан к deterministic sandbox resolution floor, а не к жёсткому порогу, который отбрасывал согласованные малые эффекты.
- Добавлены `unified-cognitive-substrate` и `anti-decoration-gates` tests.
- Добавлен `audit:substrate`.

### Научная граница

Новый substrate является **производной интеграционной проекцией**. Он не объявляет наличие сознания и не подменяет реальный evidence. Allocation и coupling signals влияют на runtime только ограниченно и наблюдаемо.

### План следующего прохода

1. Reality Event Bus + persistent entities/object permanence.
2. Causal Memory: prediction → action → outcome → causal update.
3. Unified Evidence Fabric / provenance.
4. Cross-system lesion and intervention benchmark.
5. Deeper continual learning of small local predictors and skills.
6. Android long-horizon/device gate.

## Дополнительная консолидация после первичного BIG PASS 113

После первичного прогона были выявлены и исправлены дополнительные реальные quality/architecture issues:

- `P31` truthfulness test приведён к актуальному `ConsciousnessEvidenceLedger v3` и проверяет действительно независимые observation keys.
- `P38` server smoke переведён с устаревшего endpoint на действующий system-graph surface и получил надёжный polling/cleanup.
- Runtime dependency graph Fabric очищен от 4 ownership cycles. Теперь physical-system DAG: `embodiment → world → memory → self → governance → agency/research` с 11 рёбрами.
- Старый контракт BIG PASS 58 обновлён: рекуррентность cognition больше не моделируется циклическими ownership-зависимостями.
- Добавлен `tests/world-reward-semantics.mjs`: signed reward regression сохраняет `-0.04` как функциональный reward, а нормализацию `0.48` оставляет только display-layer.
- Добавлен `BIG_PASS_113_PROGRESS_AUDIT_RU.md` с machine-readable checklist/готовностью направлений и перечнем незавершённых этапов.

Финальный принцип этого прохода: не расширять архитектуру новым P-модулем, если существующие системы можно объединить и сделать причинно сильнее.
