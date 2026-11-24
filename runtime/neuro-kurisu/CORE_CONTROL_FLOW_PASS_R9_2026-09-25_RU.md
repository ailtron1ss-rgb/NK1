# CORE CONTROL-FLOW PASS R9 — 2026-09-25

## Цель
Продолжить R8-декомпозицию `OrganismCore` без изменения доменной семантики и без переноса скрытого ownership обратно в Core.

## Реальные изменения
1. `OperationalMicroCycleRuntime.ts` — вынесен reduced-resolution life tick из `OrganismCore` в отдельный runtime с явным capability-context.
2. `ExecutionPrimitives.ts` — canonical `clamp` и `goalVectorFallback` вынесены из Core, чтобы runtime не дублировал их.
3. `OrganismCore.ts` — `runOperationalMicroCycle()` заменён делегированием через `OperationalMicroCycleRuntime`; Core получает только capability-context.
4. `audit-core-ownership.mjs` — ownership ceiling обновлён с 4 до 5 только из-за нового явного runtime owner; правило продолжает запрещать рост выше этого значения.
5. `P2724AutonomousContinualFabric.ts` — усилено восстановление неполных durable `actionModel`, `contextActionModel` и `latentActionModel`. Исправление находится у владельца состояния, а не в Core.
6. `tests/r7-3-neural-projection-restart.mjs` — обращение к бывшему внутреннему `neuralExperienceBranch` заменено на canonical public diagnostics API после ownership extraction.
7. Исправлен trailing whitespace в R8 architecture report.

## Архитектурный результат
- `OrganismCore.ts`: **9 805 → 9 727 строк** на базе R8.
- Прямые constructor owners Core: **5**; новые владельцы ограничены явным runtime composition.
- `OperationalMicroCycleRuntime` содержит только capabilities, необходимые reduced-resolution циклу.
- Новая runtime boundary не имеет прямой зависимости на orchestration-методы Core.

## Verification
- `typecheck`: PASS
- `audit:core-ownership`: PASS, `directConstructors=5`
- `audit:architecture`: PASS, `sourceFiles=1681`, `canonicalFiles=538`, `missing=0`, `cycles=0`, `legacyLeakage=0`
- `audit:hygiene`: PASS, `errors=0`, `warnings=0`
- `audit:syntax`: PASS, `js=1165`, `sh=6`, `json=240`
- `audit:contract`: PASS
- `audit:integrity`: PASS, `files=3707`, release `35.26.0`, schema `219`
- organism smoke: PASS, ~27.3 s, RSS ~567 MB in this host environment
- B285 continuity: PASS, `restart=true`
- temporal-resolution B75: PASS, `micro=11`, `pulse=1`, `tickDelta=12`, `persisted=true`
- R7.3 restart: PASS, `cycles=4`, `tick=4`, `inputLength=64`
- P2855 contextual policy: PASS, holdout accuracy `1.0`, persisted
- P2855 organism integration: PASS, 84/84 policy updates, persisted
- P2855 policy ablation: PASS, absolute gain `0.10`

## Важно
Длинные последовательные shell-запуски некоторых P2855/soak сценариев в этой среде периодически упираются в общий timeout, поэтому они не используются как единственное доказательство. Критические сценарии дополнительно прогонялись изолированно.

## Research alignment
R9 не добавляет новые ML-библиотеки. Архитектурный вывод согласуется с практикой современных SNN/learned-world-model стеков: нейронные вычислительные механизмы должны иметь отдельные runtime boundaries и обучаемые/проверяемые компоненты, а не расширять единый orchestrator. Norse предоставляет PyTorch-compatible SNN primitives; DreamerV3 разделяет world model, actor и critic и обучает их из replayed experience. Эти проекты используются как ориентир архитектурного разделения, а не как готовые зависимости.
