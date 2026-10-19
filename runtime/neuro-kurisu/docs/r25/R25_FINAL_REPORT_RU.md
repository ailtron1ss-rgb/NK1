# Neuro-Kurisu R25 — Architecture Adaptive Planning

Дата: 2026-09-30
Application: `35.39.0`
Core: `100.31.0-r25-architecture-adaptive-planning`
State schema: `222`
Phase: `Stage-124/R25-Architecture-Adaptive-Planning`

## Итог

R25 продолжает R24 двумя связанными направлениями: реальная адаптация нейронного action-readout через curvature-aware operator и реальное многошаговое обучение/планирование world model.

## Реальные изменения

- `NeuroCoreAdaptiveOperators` — диагональный running-curvature preconditioner;
- independent erase/write gates;
- B365 canonical learning path подключает новый оператор;
- B365 state v13 сохраняет состояние оператора и поддерживает восстановление старых snapshots;
- B262 state v2 получил sequence heads 5–8;
- B262 replay автоматически обучает sequence heads на последних 8 последовательных эпизодах;
- `planHierarchical()` реализует 4+4 hierarchical refinement;
- `OrganismCore` использует hierarchical planning периодически, чтобы не создавать постоянную нагрузку на мобильном runtime;
- публичные B262 API расширены для sequence train/predict и hierarchical planning.

## Evidence

R25 architecture test:

- operator updates: 96;
- B365 canonical operator updates: 576;
- persisted operator updates after restore: 576;
- sequence updates: 720;
- trained sequence error: `0.01517`;
- baseline sequence error: `0.01791`;
- sequence improvement: `0.00274`;
- hierarchical planning depth: 8;
- refinement: 4+4.

## Внешний архитектурный аудит

Из текста NeuroCore v128 перенесены только идеи, которые можно реализовать честно в текущем TS/Termux runtime. GPU/Triton/CUDA, настоящий Mamba-3 SSD/MIMO и внешний MEMO не обозначаются как внедрённые.

## Limitations

R25 не доказывает, что новый оператор глобально превосходит прежнюю пластичность на всех режимах. Также hierarchical planning пока проверен на внутреннем matched benchmark, а не на физическом Android-долгогоризонтном испытании.

## Дополнительная валидация после интеграции архитектурного анализа

Отдельные тяжёлые проверки после R25 functional-core:

- B365 causal regression: PASS, seeds=5, minScoreL1=`0.004295`;
- B365 learning-transfer: PASS, seeds=6, minPolicyL1=`0.068625`;
- 5–8-step world benchmark: PASS как тест, но long-horizon model regret=`0.01237` против baseline=`0.00346`; это НЕ улучшение baseline;
- matched recurrent ablation: recurrent=`0.346875`, stateless=`0.803125`, delta=`-0.45625`; recurrent-ветка НЕ продвигается в canonical path;
- runtime operation evidence: `165/165` verified;
- mobile semantic equivalence: PASS;
- 1000-cycle endurance: PASS, warm median=`29.87 ms`, tail median=`28.74 ms`, slowdown=`0.962x`, p95=`203.25 ms`;
- 3000-cycle endurance: не закрыт в текущем sandbox/time budget и не считается PASS.

## Решения по внешнему архитектурному анализу

Входной анализ NeuroCore v128 полезен как карта исследовательских направлений, но его численные прогнозы производительности и утверждения о полноценных Mamba-3/Triton/MEMO-модулях не считаются доказательством для Neuro-Kurisu. В canonical path интегрированы только проверяемые, Termux-совместимые элементы: diagonal curvature-aware preconditioning, независимые erase/write gates и sequence/hierarchical planning. Полноценные GPU/Triton реализации оставлены вне canonical runtime до наличия соответствующего backend и matched evidence.
