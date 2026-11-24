# NEURO-KURISU — B296 повторная проверка документов и evidence

Дата: 2026-09-13

## 1. Что перепроверено

Проверены следующие предыдущие утверждения/артефакты перед выпуском B296:

- B294 Master Audit: исторический host mobile 1000-cycle PASS не переносится автоматически в новый выпуск.
- B294_AUDIT_RECHECK_B295_RU.md: корректно отделяет историческое evidence от воспроизводимого release-gate.
- B295: adaptive compute budget и critical function passports фактически присутствуют, typecheck и dedicated tests проходят.
- Function reality audits повторены после добавления B296.
- Architecture/integrity/forensics/hygiene/release/source-truth/full audit повторены.
- Mobile 250 и mobile 1000 horizon повторены после B296.

## 2. Исправление старого mobile утверждения

В B294/B295 ранее был зафиксирован нестабильный host-result для 1000 циклов. После B296 команда `npm run test:mobile:horizon:1000` дала:

- PASS
- ratio = 0.992
- firstMedianMs = 0.13
- lastMedianMs = 0.13
- p95 = 146.39 ms
- heapFirst = 82.6
- heapLast = 176.9
- memory = 130

Это новое reproducible host evidence на текущем запуске. Оно не является доказательством работы на реальном Android/Termux устройстве: физический телефон в среде анализа отсутствует.

## 3. B295 performance baseline -> B296

Последний известный B295 operational-250 host run: p95Approx около 295.85 ms, warmedMedianRatio около 1.539.

B296 operational-250: PASS, p95Approx = 132.17 ms, warmedMedianRatio = 1.320, firstMedianMs = 75.62, lastMedianMs = 99.84, heapGrowth = 1.094.

Это рассматривается как улучшение host-runtime, но не как причинно доказанное улучшение только из-за B296: host load и benchmark variance всё ещё возможны. Поэтому в master audit добавлена формулировка «observed improvement», а не «proved sole cause».

## 4. Что B296 делает на самом деле

B296 не создаёт вторую копию личности, памяти или world model. Он является компактным нейронным readout-nucleus поверх уже существующих B269/B270/B289/B291/B293/B294/B295:

- LIF-подобная мембранная динамика с refractory state;
- sparse spike activity;
- recurrent synapses;
- pre/post traces;
- eligibility traces;
- three-factor outcome plasticity;
- neuromodulatory factor;
- homeostatic threshold adaptation;
- bounded structural maintenance;
- lesion/clear-lesion test;
- action readout, который влияет на decision score только малым bounded bias.

## 5. Реальная проверка B296

Standalone test: 384 neural cycles; 48 learning updates; 629 spikes; 5,784 synaptic updates; 100 active synapses; homeostaticError01 = 0.0462; developmentalReadiness01 = 0.5220.

Core integration: 40 organism cycles; B296 diagnostics finite; persistence field present; action bias finite; lesion reduces influence.

## 6. Дублирование и решения

B269 и B293 не объединены насильно: B269 отвечает за event-driven plastic spiking substrate, B293 — за self/world prediction. Их задачи различны и оба имеют causal/lesion evidence.

B270/B284/B285 не заменены B296: они отвечают за germinal identity, autobiographical identity и life/future-self consolidation. B296 не владеет этими canonical states.

Многочисленные actionBias() остаются потенциальной зоной консолидации. B296 введён как bounded readout, а не ещё один полный policy engine. Следующий архитектурный шаг — измерить корреляцию/избыточность action-bias каналов и вывести малополезные каналы из hot path.

`CognitiveSubsystemFacade` по-прежнему имеет методы с низкой live-reference активностью. Это остаётся отдельной задачей B297: подключить facade/registry к реальному исполнительному маршруту вместо создания нового фасада.

## 7. Function reality после B296

- sourceFiles = 1134 в function-liveness audit;
- functionLikeDeclarations = 3769;
- withBody = 3740;
- zeroReference = 214;
- oneOrLessReference = 680;
- parameterized safe: 910 attempted / 876 passed / 0 failed;
- semantic coverage: 3649 functions;
- VERIFIED = 38;
- INTEGRATION_ONLY = 835;
- UNSAFE_TO_AUTO_RUN = 259;
- UNVERIFIED = 2517;
- verifiedRate01 = 0.0104;
- evidenceCoverage01 = 0.0676.

Следствие: B296 не объявляет «весь проект полностью проверенным». Напротив, audit продолжает явно показывать большой хвост непрроверенных функций.

## 8. Архитектурный evidence

- architecture PASS: sourceFiles=1121, canonicalFiles=381, missing=0, cycles=0, legacyLeakage=0;
- integrity PASS: files=2263, schema=127;
- hygiene PASS: errors=0, warnings=0;
- full audit: errors=0, warnings=0;
- API routes: 110, duplicates=0.

## 9. Потенциал

Проект имеет высокий экспериментальный потенциал как мобильный synthetic cognitive organism, потому что уже сочетает causal learning, continual learning, identity/personality, world prediction, embodied state, autonomous goal systems и event-driven neural substrates.

Но это ещё не доказанное искусственное сознание и не биологически точная модель мозга. Основной риск — чрезмерное число параллельных cognitive/action channels и низкая доля функций с прямым execution evidence. Архитектурное качество теперь должно расти за счёт consolidation и evidence closure, а не только добавления новых модулей.

## 10. Следующий самостоятельный шаг

B297: консолидация executive action-bias ecology + реальное включение CognitiveSubsystemFacade/Registry в hot path; затем B298 — связывание B294 episode IDs с уже существующими CognitiveEventFabric/CausalLifeGraph без второго event store; после этого — bounded imagination поверх существующего B262 world model, без второго world model.
