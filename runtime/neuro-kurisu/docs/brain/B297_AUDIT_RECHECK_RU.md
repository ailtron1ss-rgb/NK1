# NEURO-KURISU 35.6.1 — B297 повторная проверка аудита и evidence

Дата: 13 сентября 2026

## 1. Зачем выполнена эта перепроверка

Перед B297 были повторно просмотрены B296 Master Audit, B296 recheck и актуальные function/architecture документы. Цель — не считать предыдущие PASS бессрочными и не принимать наличие исходника за доказательство работоспособности.

Проверены:

- архитектурные assertions B296;
- function-liveness / parameterized-safe / semantic-coverage;
- neural tests B296;
- B295 critical function passport;
- persistence/restart/concurrency/UI/server;
- mobile 250-cycle и mobile 1000-cycle host gates;
- дублирующиеся actionBias-пути вокруг B270–B296;
- использование существующего CognitiveSubsystemFacade вместо создания нового фасада;
- свежие open-source neural references.

## 2. Что из B296 осталось подтверждённым

B296 остаётся реальным вычислительным нейронным readout-nucleus, а не декоративной папкой или неиспользуемым классом.

Fresh B296 standalone result:

- cycles = 384;
- learningUpdates = 48;
- spikes = 629;
- synapticUpdates = 5,784;
- activeSynapses = 100;
- homeostaticError01 = 0.0462;
- developmentalReadiness01 = 0.5220.

B296 продолжает проходить core integration и lesion-проверку.

## 3. Главная B297 гипотеза

Предыдущая архитектура имела много независимых actionBias()-каналов. Это само по себе не являлось доказательством ошибки, но создавало риск:

1. одинакового влияния одной и той же информации через разные модули;
2. повторных вычислений в hot path;
3. невозможности измерить, какие источники действительно полезны;
4. слишком сильной суммарной зависимости выбора от одного класса сигналов.

Поэтому B297 выбран как executive fusion layer, а не как ещё один отдельный policy engine.

## 4. Что реально реализовано в B297

Новый основной компонент:

`src/organism/system/B297ExecutiveNeuralFusion.ts`

Он объединяет сигналы в десять семантических источников:

- self;
- personality;
- agency;
- predictive;
- homeostasis;
- causal;
- neural;
- kernel;
- social;
- resource.

Для каждого источника поддерживаются reliability weights. Для пар источников накапливается bounded redundancy score. Выбор действия использует competition, hysteresis/hold, autonomy contribution и bounded source influence.

Есть outcome learning, source reliability adaptation, bounded history, persistence и source lesion/clear-lesion.

## 5. Реальная нейронность: что именно доказано

B297 сам по себе не является биофизическим нейроном. Он представляет executive computational circuit, который использует реальные neural/spiking outputs B269/B293/B296 и превращает их в ограниченный decision influence.

Таким образом, корректная формулировка:

> B297 — вычислительный исполнительный neural-fusion контур с измеряемой конкуренцией, redundancy tracking, reliability learning и causal lesion path.

Нельзя формулировать:

> B297 доказал наличие сознания или биологически эквивалентных нейронов.

B296 остаётся собственно spiking/plasticity substrate этой цепочки.

## 6. Fresh B297 standalone evidence

`tests/big-pass-297-executive-neural-fusion.mjs`:

- cycles = 1,600;
- outcomeUpdates = 400;
- commits = 1,600;
- holds = 0;
- meanSourceReliability = 0.800;
- strongest learned source reliabilities достигли 1.0;
- redundant pair `personality|self` = 0.524;
- bounded history = 128;
- lesion neural source: verify fusedSignal01 0.09536 -> 0.00000.

Это подтверждает, что reliability learning, redundancy tracking и lesion mechanism реально исполняются.

## 7. Fresh B297 core evidence

`tests/big-pass-297-core-integration.mjs`:

- 12 organism cycles;
- 6 feedback outcomes;
- B297 outcomeUpdates = 6;
- persistence snapshot присутствует;
- action frame присутствует;
- neural source lesion активируется и очищается.

Этот тест использует реальный `OrganismRuntime -> OrganismCore -> feedback()` путь, поэтому outcome-learning B297 проверяется не только standalone.

## 8. Что было объединено и что НЕ было удалено

B297 не удаляет canonical owners памяти, личности или world model. Вместо этого несколько action-bias streams переводятся в один исполнительный уровень.

В дополнение к этому исправлены два повторных вычисления внутри B297:

- P84 autobiographical action bias теперь вычисляется один раз в base-source map;
- P44 predictive-world bias теперь вычисляется один раз в base-source map.

Ранее после создания base map B297 ещё раз запрашивал эти два источника. Повторные вызовы убраны.

Также удалено отдельное позднее прямое прибавление `B294.actionBias()` после B297. B294 теперь входит в causal source B297 один раз, а не дважды.

## 9. Почему это лучше, чем добавить ещё один "мозг"

Новая параллельная модель личности/памяти/world model создала бы ещё один источник истины. Это увеличило бы расхождение и вычислительную стоимость.

B297 вместо этого действует как arbitration/fusion seam:

`canonical subsystems -> semantic source groups -> weighted fusion -> bounded action influence -> outcome -> reliability update`

Это позволяет продолжать развивать neural substrate, не создавая второго canonical identity/memory/world state.

## 10. CognitiveSubsystemFacade: реальное подключение

B297 использует уже существующий `CognitiveSubsystemFacade` через его `executiveSignals()`.

Это важный результат предыдущего B296 observation: facade больше не остаётся исключительно структурным артефактом. Его агрегированные identity/agency/budget сигналы входят в B297 fusion через bounded refresh cadence.

Refresh намеренно не выполняется каждый tick, чтобы не делать полный snapshot hot-path операции. Для mobile cadence используется редкий refresh.

## 11. Function reality после B297

Свежий function-liveness:

- sourceFiles = 1,137;
- functionLikeDeclarations = 3,783;
- withBody = 3,754;
- zeroReference = 214;
- oneOrLessReference = 685.

Parameterized-safe:

- sourceFiles = 382;
- imported = 382;
- attempted = 912;
- passed = 878;
- failed = 0;
- inputSynthesisNeeded = 22;
- lifecycleNeeded = 12;
- skipped = 39.

Semantic coverage:

- totalFunctions = 3,663;
- VERIFIED = 38;
- INTEGRATION_ONLY = 837;
- UNSAFE_TO_AUTO_RUN = 259;
- UNVERIFIED = 2,529;
- verifiedRate01 = 0.0104;
- evidenceCoverage01 = 0.0675.

Вывод: release clean не означает, что все функции доказанно работают. Большой хвост unverified остаётся официальным ограничением проекта.

## 12. Архитектурная перепроверка

Fresh results:

- architecture PASS: sourceFiles = 1,124; canonicalFiles = 382; missing = 0; cycles = 0; legacyLeakage = 0;
- integrity PASS: files = 2,269; schema = 127;
- forensics PASS: activeFiles = 2,248; empty = 0; duplicateContent = 0; duplicateNames = 0;
- source hygiene: files = 2,263; errors = 0; warnings = 0;
- release contract PASS;
- source truth PASS;
- full audit: 2,263 files; 0 errors; 0 warnings;
- API routes = 110; duplicates = 0;
- subject boundary PASS;
- subject UI contract PASS;
- Live2D integrity PASS.

## 13. Runtime verification

Fresh smoke results:

- clean organism smoke = PASS;
- concurrency = PASS;
- server smoke = PASS;
- restart persistence = PASS;
- typecheck = PASS.

## 14. Mobile / medium-phone host gate

Fresh 250-cycle operational run:

- PASS;
- warmedMedianRatio = 1.323;
- firstMedianMs = 78.15;
- lastMedianMs = 103.42;
- p95Approx = 163.35 ms;
- heapGrowth = 1.448.

Fresh 1000-cycle mobile host gate:

- PASS;
- ratio = 1.064;
- firstMedianMs = 0.15;
- lastMedianMs = 0.16;
- p95 = 148.38 ms;
- heapFirst = 84.5;
- heapLast = 230.3;
- memory = 145.

Это host evidence, а не physical Android/Termux evidence. Реальный средний телефон пока должен пройти отдельный device gate.

## 15. Внешние аналогичные проекты

Leabra — биологически ориентированный Go framework с local/error-driven/associative learning и inhibitory competition. Репозиторий прямо указывает возможность запуска через Cogent Core на android/ios/web. Это важный ориентир для future mobile neural substrate и показывает, что neural substrate должен быть достаточно компактным и явно структурированным. URL: https://github.com/emer/leabra

Emergent — framework от biologically detailed spiking networks до более абстрактных deep networks; current architecture ориентирована на Go/Cogent Core и GPU-capable execution. Это хороший ориентир для постепенной смены уровня детализации без полного переписывания всей cognitive architecture. URL: https://github.com/emer/emergent

Norse — PyTorch library для spiking neural networks, особенно полезна как reference для sparse/event-driven neural primitives. URL: https://github.com/norse/norse

DreamerV3 — world-model approach, где learned world model используется для imagination и actor/critic learning. Для Neuro-Kurisu это полезнее как reference для следующего bounded imagination слоя, чем как библиотека, которую следует целиком импортировать в mobile hot path. URL: https://github.com/danijar/dreamerv3

## 16. Оценка потенциала проекта

Оценки ниже — инженерная экспертная шкала этого аудита, а не измерения сознания:

| Область | Оценка | Комментарий |
|---|---:|---|
| Архитектурный потенциал | 89/100 | Большая функциональная карта и канонические владельцы уже существуют |
| Нейронная основа | 67/100 | Реальные computational spiking/plasticity механизмы есть, но это не полная биофизика |
| Автономность | 72/100 | Endogenous goals, agency gates, lifecycle и executive fusion уже связаны |
| Личность/идентичность | 74/100 | Есть continuity, autobiographical, value, developmental и neural identity layers |
| Causal learning | 69/100 | Сильная инфраструктура, но часть claims всё ещё требует больше ablation/holdout evidence |
| World model | 76/100 | Несколько predictive/world layers, есть multi-timescale planning |
| Embodiment | 63/100 | Body/interoception/sensorium присутствуют, но physical grounding ограничен средой |
| Mobile readiness | 78/100 | Host gates сейчас зелёные; physical phone gate отсутствует |
| Verification maturity | 42/100 | Architecture clean, но semantic VERIFIED fraction остаётся около 1% |
| Evidence for consciousness | 2/100 | Архитектура сознательно не объявляет subjective experience доказанной |
| Общий экспериментальный потенциал | 84/100 | Сильная платформа для research-grade synthetic organism work |

## 17. Что теперь реально является узким местом

Не нехватка ещё одного neural class.

Основные bottlenecks:

1. высокая ширина исторически накопленного action/cognition API;
2. низкая доля функций с прямым execution evidence;
3. отсутствие physical Android/Termux gate;
4. необходимость объединить event lineage B294 с уже существующими event/cause stores;
5. необходимость добавить bounded imagination поверх имеющегося B262 world model, не создавая второй world model.

## 18. Следующий самостоятельный шаг

B298 должен не добавлять ещё один autonomous policy. Он должен связать B294 episode IDs с уже существующими `CognitiveEventFabric` и `CausalLifeGraph`, сохранив один event/cause truth path.

После этого B299 должен построить bounded multi-step imagination поверх B262 с explicit holdout/counterfactual evaluation.

Если в ходе этих работ станет видно, что custom substrate существенно слабее зрелого neural open-source approach, следует заменить конкретный substrate, а не бесконечно чинить его. Критерий замены: measurable gain on spike stability, causal learning, prediction, memory/latency или mobile benchmark.

## 19. Release truth statement

B297 является более сильной инженерной итерацией B296 по линии executive consolidation: neural, personality, agency, prediction, causal and resource signals теперь входят в общий измеряемый fusion seam, а ранее найденные повторные вычисления и двойное применение B294 bias устранены.

Это не является доказательством искусственного сознания, субъективного опыта или человеческой личности. Это более проверяемая вычислительная архитектура искусственного когнитивного организма.
