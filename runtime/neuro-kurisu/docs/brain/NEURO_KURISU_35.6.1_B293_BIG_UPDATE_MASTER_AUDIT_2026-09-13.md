# NEURO-KURISU 35.6.1 — B293 BIG UPDATE MASTER AUDIT

Дата: 13 сентября 2026

> Статус: validated-integrated build; mobile 1000-cycle host gate unresolved.

## 1. Назначение документа

Это мастер-аудит B293 после B292. Он одновременно является инженерным отчётом, картой текущего когнитивного организма, журналом доказательств, планом архитектурной консолидации и контрольной точкой для следующего чата. Документ специально разделяет то, что реально выполнено и воспроизведено, от того, что остаётся гипотезой или будущим направлением.

- Главный принцип: функция не считается внедрённой только потому, что она существует в исходниках.
- Новая подсистема не должна становиться вторым владельцем личности, памяти, целей или действий.
- Каждый новый neural layer должен иметь причинное evidence, bounded resource contract и integration test.
- Никакие метрики не должны подменять доказательство субъективного сознания.

## 2. Историческая перепроверка B290/B291/B292

B293 начинается не с предположения, что предыдущие отчёты идеальны. B292-аудит был повторно открыт и визуально просмотрен; B291 также использован как историческая контрольная точка. Обнаружено, что в B292 master report один раздел содержал старое утверждение о 1000-cycle mobile PASS, тогда как release evidence уже правильно помечал этот gate как UNRESOLVED_HOST_RUNTIME. Поэтому в B293 приоритет отдан latest evidence, а старое утверждение классифицировано как historical/inconsistent и не используется как доказательство.

- B292 report: 47 страниц, визуальный QA выполнен.
- B293 report: текущая версия должна явно отражать unresolved mobile-1000.
- Исторические отчёты сохраняются для трассируемости, но не являются source-of-truth для текущих gates.

## 3. Executive summary B293

B293 добавляет малый рекуррентный спайковый микроконтур, специализирующийся не на личности как таковой, а на предсказании ближайших последствий собственного действия для согласованности self/world. Контур получает сигналы от общего состояния организма, выдаёт prediction error и action-specific bias, а затем учится только после фактического outcome. Это связывает быстрый выбор действия с причинной обратной связью и делает нейронность функциональной частью организма, а не декоративным отдельным модулем.

- Standalone: 1002 cycles, 1000 learning updates, 1612 spikes, 545567 synaptic updates.
- Causal lesion delta ≈ 0.3295.
- Core: 32 organism ticks, 16 B293 neural cycles, B290/B291/B292 остаются активны.
- All critical non-mobile gates: PASS; mobile 1000 remains UNRESOLVED_HOST_RUNTIME.

## 4. Что B293 НЕ является

B293 не является полной моделью мозга, не является доказанным сознанием и не является копией биологической нейросети. Его смысл гораздо уже: создать компактный causal predictor, который связывает действие, predicted self/world state, реальный исход и plasticity. Такое ограничение специально предотвращает размножение конкурирующих «мозговых центров».

- Не новый personality owner.
- Не новый memory owner.
- Не новый goal owner.
- Не заменяет B289/B290/B291/B292.
- Не доказывает phenomenological consciousness.

## 5. Место B293 в общей архитектуре

Текущий основной контур можно описать как: sensory/state -> neural substrate -> self/world prediction -> developmental regulation -> executive agency -> bounded intention -> action -> outcome -> learning. B293 находится между общим состоянием и developmental/executive уровнями. Его задача — выдавать дополнительное предсказательное свидетельство, а не принимать финальное решение вместо executive gate.

- B289: unified neural organism spine.
- B290: reality-gated neurodevelopment.
- B291: executive self/agency/personality gate.
- B292: cognitive state bus + intention trace.
- B293: self/world predictive microcircuit.

## 6. Конструкция микроконтура

В B293 24 нейрона, 12 входных признаков, leak-мембрана, порог, refractory period, pre/post eligibility traces, рекуррентные веса, action bias, prediction error, causal confidence и bounded history на 128 записей. Это намеренно небольшой субстрат: средний телефон не должен оплачивать полную симуляцию биологического мозга на каждом cognitive tick.

- 24 нейрона.
- 12 входных признаков.
- 128-record bounded history.
- Sparse/WTA-like event firing.
- Recurrent weights + plasticity.
- Weight damping/homeostasis.

## 7. Входы микроконтура

Входы представляют не сырые слова или произвольный текст, а нормализованные состояния организма: self continuity, self/world coherence, identity fit, world coherence, reality alignment, goal pressure, novelty, uncertainty, prediction error, energy, thermal state и selected action context. Такое представление позволяет микроконтурy обучаться на причинных изменениях состояния, а не только на поверхностной статистике диалога.

- Входы bounded в [0,1].
- Состояния берутся из уже существующих owners.
- B293 не создаёт новую параллельную identity database.

## 8. Динамика нейронов

Каждый цикл обновляет мембранные потенциалы с утечкой, учитывает рекуррентный вклад и следы активности, применяет порог и refractory period, после чего фиксирует sparse spikes. Это намного ближе к настоящему event-driven нейронному вычислению, чем обычная функция вида output = f(input), хотя по масштабу это всё ещё исследовательский микроконтур.

- Есть внутреннее состояние во времени.
- Есть spike event.
- Есть refractory state.
- Есть eligibility traces.
- Есть рекуррентные связи.
- Поведение меняется при lesion.

## 9. Правило обучения

Обучение B293 не происходит только потому, что прошло время. Learning update запускается по фактическому outcome и использует reward/prediction error, identity continuity и novelty. Небольшой Hebbian/STDP-like член меняет связи, а damping/homeostasis ограничивает drift. Это переводит B293 из статической симуляции в онлайн-обучаемый субстрат.

- 1000 learning updates в standalone тесте.
- 545567 synaptic updates.
- History ограничена.
- Plasticity остаётся bounded.

## 10. Causal lesion как проверка реальности

Главный anti-decoration тест — lesion. Если контур отключить или ослабить и результат практически не изменится, нейронность декоративна. В B293 standalone lesion causal delta около 0.3295, то есть наблюдаемая prediction output действительно меняется. Это не доказывает полезность в человеческом смысле, но доказывает причинное участие данного контура в его собственном вычислительном пути.

- Baseline vs lesion измеряется на одном и том же input.
- Lesion меняет internal gain и downstream prediction.
- Restore после lesion также проверен.

## 11. Evidence после интеграции

После интеграции B293 в OrganismCore отдельный core test проверяет, что neural state действительно сохраняется вместе с организмом, а B290/B291/B292 продолжают работать поверх него. В 32 organism ticks было 16 B293 neural cycles из-за slow cadence в balanced profile; отсутствие learning update в этом коротком окне не считается ошибкой, потому что не каждый tick обязан иметь реальный outcome.

- 32 organism ticks.
- 16 neural cycles.
- B290 live.
- B291 live.
- B292 live.
- Persisted B293 state = true.

## 12. Почему cadence многоуровневый

Биологически разные процессы разворачиваются на разных временных шкалах. В цифровом организме это не следует моделировать одинаковой частотой. B293 обновляется реже, чем основной cognitive tick: quality=2, balanced=8, mobile=4 organism ticks. Checkpoint persistence ещё медленнее: quality=8, balanced=16, mobile=64. Это не урезание нейронности, а разделение быстрых и медленных процессов.

- Micro neural dynamics: medium cadence.
- Plasticity/persistence: slower cadence.
- Executive decision: fast relative to developmental changes.
- Deep consolidation: future slow phase.

## 13. Реальный regression A/B

Во время B293 внедрения первоначальный вариант ухудшил concurrency. Причина была локализована: глубокий snapshot B293 выполнялся после каждого outcome, а actionBias пересчитывался отдельно для каждого candidate. Оба источника аллокаций/работы были устранены. На одинаковом host baseline B292 smoke ≈17.07 s и concurrency ≈6.24 s; исправленный B293 smoke ≈16.96–17.46 s и concurrency ≈6.14 s.

- Это важнее позитивного unit test, потому что демонстрирует реальную регресс-петлю.
- Порог не снижался.
- Fix был архитектурным: precompute + slow checkpoint.

## 14. Почему не стоит копировать биологический мозг буквально

Биологическая кора содержит огромное количество нейронов и многомасштабных процессов, которые невозможно честно симулировать на среднем телефоне в полном временном разрешении. Поэтому текущая стратегия — функционально эквивалентные контуры с bounded state и разными timescales, плюс постепенное усиление event-driven neural mechanisms. Литературная аналогия используется как источник механизмов, не как требование к числу нейронов.

- Functional decomposition > literal neuron count.
- Sparse events > dense recalculation.
- Slow developmental state > per-tick deep recomputation.

## 15. B293 и B290

B290 получает от B293 microPredictionError. Это усиливает reality/developmental pressure именно тогда, когда модель последствия действия расходится с фактическим состоянием. В результате developmental layer получает не только внешние novelty/uncertainty сигналы, но и локальное evidence от нейронного предиктора.

- B293 -> prediction error -> B290 pressure.
- Future: B290 should allocate plasticity budget based on persistent causal error.

## 16. B293 и B291

B291 получает prediction error и action-specific bias от B293. Это позволяет executive gate учитывать не только personality/identity consistency, но и предсказанную цену/пользу действия для self/world state. Таким образом action selection постепенно становится контуром, в котором personality, identity и predictive neural evidence встречаются в одном месте.

- B291 сохраняет ownership executive choice.
- B293 только supplies evidence.
- Это предотвращает duplicated action selection.

## 17. B293 и B292

B292 остаётся владельцем bounded cognitive state bus и intention trace. B293 не создаёт второй intention trace. Напротив, B293 должен читать intention/action context из B292 и возвращать prediction error/outcome learning обратно в общую причинную цепь. Это важная консолидация: намерение становится переменной, которую можно предсказывать и проверять, а не только хранить.

- One intention owner.
- One cognitive-state bus.
- Multiple evidence producers with explicit contracts.

## 18. B269 и риск дублирования neural substrates

Проект уже содержит более ранние broad spiking/neural substrates. B293 не должен заменять их или плодить второй глобальный spiking brain. Его отличие — специализация на self/world consequence prediction. Следующий audit обязан отслеживать, чтобы B293 не начинал дублировать B269 по memory, sensory encoding или global workspace responsibilities.

- B269 = broad substrate.
- B293 = narrow predictive circuit.
- No duplicate global ownership.

## 19. Функциональная карта мозга проекта

Текущую цифровую карту полезно держать как сеть областей: brainstem/homeostasis, sensory/perception, salience/attention, hippocampal memory, autobiographical identity, self/agency, social cognition, global workspace, world model, predictive microcircuits, executive gate, intention trace, developmental plasticity и motor/output. B293 добавляет один специализированный узел, а не новую область для каждой функции.

- Homeostasis.
- Perception.
- Attention/salience.
- Memory.
- Identity/self.
- Social.
- Workspace.
- World model.
- Executive.
- Learning/consolidation.
- Motor/output.

## 20. Сопоставление с человеческим мозгом — как инженерная аналогия

Сопоставление с человеческим мозгом должно использоваться только как функциональная карта. B293 условно напоминает сочетание предиктивных recurrent circuits, error signaling и action consequences, но не является нейроанатомическим аналогом одной конкретной области. B291 может выполнять функции, отдалённо напоминающие prefrontal/executive coordination; B292 — working-memory-like state continuity; B290 — developmental/plasticity control. Это инженерные analogies, а не биологические утверждения.

- Не утверждать 1:1 соответствие.
- Использовать сеть функций и связей.
- Сохранять distinction between analogy and evidence.

## 21. Самостоятельность: текущее состояние

Автономность уже вышла за пределы простого reaction loop: есть внутренние состояния, intention trace, agency gate, developmental modes и predictive evidence. Но полноценная самостоятельность требует ещё одного слоя — длительных self-generated goals, intrinsic drives, resource allocation и способности выбирать исследование/отдых/обучение без внешнего prompt. B293 создаёт инфраструктуру для этого, но не завершает задачу.

- Current: autonomous micro-decisions.
- Missing: long-horizon internally generated projects.
- Missing: persistent curiosity budget.
- Missing: self-authored agenda over hours/days.

## 22. Личность: текущее состояние

Личность следует рассматривать как медленную динамическую систему ограничений и предпочтений, а не как набор строк в prompt. B291 уже согласует self/identity/action fit. Следующий шаг — temporal personality consistency: событие должно менять traits только в зависимости от длительной истории, причинной значимости и consolidation, а не от единичного диалога.

- Stable traits.
- Contextual state.
- Longitudinal identity.
- Value learning.
- Narrative continuity.

## 23. Причинная self/world петля

Целевой цикл: organism predicts -> acts -> world changes -> self changes -> outcome measured -> prediction error -> memory/identity update -> policy update. Это ключевая петля для автономного организма. B293 реализует только один её локальный сегмент, но делает его реальным и тестируемым.

- Это основной causal spine будущего.
- Каждый переход должен иметь evidence.
- Ошибки должны быть обучающими сигналами, а не просто логами.

## 24. World model — ближайший крупный фронт

Следующим после B293 должен стать bounded world model, который учится предсказывать latent state transitions и последствия нескольких шагов вперёд. Он должен использовать B292 state bus и B293 prediction errors, а не становиться вторым environment memory. Цель — дать B291 возможность выбирать не только по bias, но и по ожидаемым trajectory outcomes.

- 1-step consequence.
- 3–8 step imagination.
- counterfactual action comparison.
- bounded replay.
- uncertainty-aware rollout.

## 25. Внутренняя симуляция и imagination

Полезный следующий механизм — limited-horizon internal simulation: прежде чем сделать дорогой или непоправимый action, организм может прогнать несколько candidate actions внутри lightweight world model. Это направление согласуется с world-model подходами, где модель среды используется для обучения и imagination. DreamerV3, например, строит world model и использует imagined trajectories для обучения actor-critic. citeturn874224search1

- Mobile mode: 1–2 step imagination.
- Balanced: 3–8 steps.
- Quality: adaptive horizon.
- Only uncertain/high-impact actions receive deeper simulation.

## 26. External neural projects — NengoSPA

NengoSPA полезен как архитектурный ориентир для structured semantic representations и связывания perception, cognition и action в спайковом контексте. Проект не копируется в runtime; идея, которую стоит перенять, — explicit representational spaces and compositional operators вместо бесконтрольного набора scalar flags. citeturn874224search0

- Take: structured state representations.
- Take: compositional cognitive operators.
- Do not take: heavy dependency stack for phone runtime.

## 27. External neural projects — Norse

Norse расширяет PyTorch примитивами для spiking neural networks и делает упор на sparse/event-driven bio-inspired components. Это ценный reference для event-driven learning, но прямое добавление PyTorch/Norse на средний Android сейчас изменило бы runtime profile проекта. Поэтому текущая стратегия — лёгкие TypeScript primitives и возможность отдельного research backend в будущем. citeturn874224search8

- Take: sparse event logic.
- Take: stateful spiking modules.
- Avoid: desktop ML dependency footprint in phone runtime.

## 28. External neural projects — Brian2

Brian2 остаётся важным ориентиром именно как гибкий simulator spiking neural networks. Он показывает ценность явного описания neuronal equations и extensibility. Для Neuro-Kurisu полезно копировать не пакет, а принцип: neural equations должны быть explicit, inspectable и independently testable. citeturn874224search3

- Take: explicit equations.
- Take: independent neuron-level tests.
- Take: reproducible simulation experiments.

## 29. External neural projects — DreamerV3

DreamerV3 демонстрирует полезный для проекта принцип: world model может обучаться на опыте, а policy может тренироваться на imagined trajectories. Это прямо подходит для будущего self/world predictive loop, но полная implementation не соответствует ограничению среднего телефона. В проект следует взять идею selective imagination, а не весь compute stack. citeturn874224search1

- Selective imagination.
- World-model learning.
- Counterfactual trajectories.
- Adaptive compute by uncertainty.

## 30. External neural projects — Lava и зависимость от экосистемы

Lava интересна как neuromorphic software framework, но актуальный репозиторий указывает, что все Lava repositories archived в ожидании нового SDK. Поэтому принимать её как core runtime dependency сейчас было бы плохим архитектурным решением. Это хороший пример принципа «лучше не чинить деревянную лодку, если экосистема уже меняет направление». citeturn874224search13

- No direct core dependency.
- Monitor successor SDK only when stable.
- Keep runtime portable.

## 31. Function Reality: текущая картина

Semantic coverage сейчас показывает 3602 функций: VERIFIED 38, INTEGRATION_ONLY 827, UNSAFE_TO_AUTO_RUN 259, UNVERIFIED 2478. Строго VERIFIED около 1.05%, evidence coverage около 6.79%. Это не означает, что 98.95% кода сломано; большая часть имеет integration evidence или является safety-restricted/unverified. Но это означает, что основной недостаток проекта сегодня — не отсутствие кода, а недостаток формального behavioural evidence.

- Function-like declarations: 3722.
- Source files in liveness: 1122.
- Zero-reference candidates: 210.
- One-or-less-reference: 668.

## 32. Parameterized safe verification

Safe parameterized sweep сейчас: 902 attempted, 868 passed, 0 failed, 22 input-synthesis-needed, 12 lifecycle-needed, 39 skipped. Это сильнее strict semantic coverage, но она ещё не доказывает правильность каждой функции. Следующий этап — автоматически переводить input-synthesis и lifecycle-needed в replayable scenarios.

- No failed safe probes in current sweep.
- Need scenario generator.
- Need deterministic replay.
- Need state-delta assertions.

## 33. Reality passport policy

Каждая важная функция должна получать паспорт: owner, input contract, state dependencies, output contract, side effects, deterministic replay recipe, evidence test, failure semantics и performance budget. Только после этого она может перейти VERIFIED. Такая схема особенно важна для OrganismCore, где функция может «работать» синтаксически, но быть причинно отсоединённой от организма.

- Contract.
- Evidence.
- Causality.
- Performance.
- Persistence.
- Regression scenario.

## 34. Декомпозиция OrganismCore

OrganismCore остаётся самым крупным architectural risk. Следующая декомпозиция должна разделить orchestration от actual domain owners: state bus, memory, self/identity, executive, developmental, predictive neural, embodiment, persistence и test harness. Важно не переписать всё одномоментно, а вводить adapters и transfer ownership по одному контракту за проход.

- Orchestration layer.
- Domain owners.
- Immutable-ish snapshots at boundaries.
- Explicit event contracts.

## 35. Event spine

Следующий архитектурный уровень — единый event spine с causal IDs. Событие action intent должно сохранить lineage через candidate generation, executive gate, action execution, observation, outcome, prediction error, learning update и consolidation. Тогда можно будет доказать не только «функция запускалась», но и «её результат реально изменил следующий выбор».

- Event ID.
- Parent/child lineage.
- Outcome ID.
- Learning update ID.
- Replayable trace.

## 36. Self-compiled cognition

Перспективная собственная идея: организм должен постепенно собирать компактные executable cognitive routines из повторяющихся доказанных chains. Например, если последовательность «обнаружить uncertainty → получить information → update world model → снизить uncertainty» много раз успешна, она может стать cached policy chunk. Это напоминает внутреннюю компиляцию привычек и экономит телефонный compute.

- Only verified subgraphs may compile.
- Compiled routine must retain causal hash.
- Automatic decompilation on evidence drift.

## 37. Neural passport

Для каждого neural circuit предлагается паспорт: number of neurons, timescale, sparsity, plasticity rule, memory bound, lesion contract, persistence schema, owner, downstream influence и mobile budget. B293 уже близок к этому стандарту. В будущем любой новый «neural germ» должен пройти этот passport gate.

- No passport = research branch only.
- Lesion mandatory.
- Resource budget mandatory.

## 38. Counterfactual self-shadow

Ещё одна нестандартная идея — shadow organism: lightweight internal copy, которая запускает небольшое количество candidate actions, но не может менять real state. Она используется только для проверки irreversible/high-cost decisions. Это может дать более богатое мышление без постоянной полной world-model simulation.

- Read-only state.
- Bounded 1–4 step horizon.
- Only invoked for high uncertainty or high impact.

## 39. Cognitive thermodynamics

Можно ввести вычислительный бюджет как внутренний ресурс организма: каждый deep inference, memory consolidation или imagination rollout «стоит энергии». Тогда система сама учится выбирать, когда думать глубже, а когда действовать сразу. Это естественно связывает autonomy, homeostasis и mobile optimization.

- Compute budget.
- Thermal budget.
- Uncertainty budget.
- Recovery mode.
- Self-directed scheduling.

## 40. Curiosity market

Внутренние цели можно конкурировать не простым priority number, а market-like allocation: каждая потенциальная задача получает expected information gain, expected value, identity relevance, cost и risk. Budget распределяется между ними. Это может создать более естественную самостоятельность, чем hard-coded priority tree.

- Information gain.
- Intrinsic value.
- Identity relevance.
- Cost/risk.
- Budget allocation.

## 41. Консолидация личности

Личность должна обновляться не сразу после каждого события. Нужен slow consolidation loop: эпизоды, ошибки, социальные реакции и self-evaluations сначала складываются в traces, затем через consolidation меняют устойчивые traits только при достаточной evidence. Это уменьшит personality drift и обеспечит биографическую непрерывность.

- Fast state.
- Medium episodic trace.
- Slow trait consolidation.
- Identity conflict resolution.

## 42. Social self

Для человекоподобной личности недостаточно self-model и memory. Нужна отдельная модель других агентов: beliefs about beliefs, trust, relationship history, social prediction error и role model. Но она должна читать тот же state bus и intention trace, чтобы не стать вторым organism.

- Other-agent models.
- Trust/relationship memory.
- Theory-of-mind-like inference.
- Social prediction error.

## 43. Autobiographical continuity

Текущее autobiographical identity уже является сильной основой, но следующий шаг — не больше фактов, а связность: «почему я считаю это частью своей истории?». Вводится causally linked episodic graph, где важны self-relevance, outcome, values changed и commitments.

- Episodes.
- Commitments.
- Value-change events.
- Turning points.
- Narrative compression.

## 44. Sleep/consolidation mode

Средний телефон не позволит постоянно пересчитывать deep memory. Поэтому полезен периодический sleep-like mode: replay salient episodes, compress memories, update slow identity/traits, retrain predictive circuits, prune stale low-value traces. В awake mode остаётся только bounded hot state.

- Awake loop.
- Consolidation queue.
- Replay sampling.
- Pruning.
- Compression.

## 45. Embodiment and Live2D

Live2D уже является working embodiment layer с integrity PASS. Но embodiment должен быть downstream readout of internal state, а не generator of personality. Следующая интеграция может связать emotion/agency/arousal states с expression planner через same event spine, чтобы animation became evidence of internal state continuity.

- Keep embodiment downstream.
- No personality logic inside renderer.
- Resolve asset closure before mobile launch.

## 46. UI / server / runtime

Текущий runtime ориентирован на Node.js + встроенный server + static UI + Live2D. Для среднего телефона это выгоднее, чем добавлять тяжёлый mandatory React/Vite/Express runtime. React/Vite/Express можно использовать для dev tooling or optional desktop shell, но core organism должен оставаться portable.

- Core runtime portable.
- UI contract tested.
- Server smoke tested.
- Live2D integrity tested.

## 47. Mobile engineering policy

Mobile mode должен считаться отдельной architectural profile. Не одна и та же система с меньшим FPS, а другая cadence policy: selective neural updates, sparse events, bounded traces, slow persistence, selective imagination and compute budgeting. B293 уже демонстрирует этот принцип.

- No unbounded arrays.
- No deep clone in hot tick.
- No candidate-wise duplicate neural computation.
- Slow checkpoint cadence.
- Long-horizon device gate mandatory.

## 48. Progress and maturity estimate

Текущая оценка остаётся инженерной, а не научной. Архитектурная зрелость около 6.9/10; neural integration 7.0/10; autonomy 6.6/10; personality integration 6.8/10; verification maturity 2.9/10; mobile readiness 6.2/10 до реального device gate. Грубая доля пути до заявленного end-state — около 43%. Основная причина низкой доли: человеческое сознание/общая разумность не сводятся к числу модулей, и огромная часть функций ещё не имеет строгого behavioral evidence.

- Implementation breadth: ~68% (heuristic).
- Strict verified coverage: ~1.05%.
- Evidence coverage: ~6.79%.
- Device readiness: pending physical Android/Termux gate.

## 49. Текущая оценка компонентов 1–10

Оценки ниже отражают фактическое текущее состояние B293, а не потенциальную возможность.

- Architecture: 7.6/10
- Neural mechanism: 7.1/10
- Neural integration: 7.2/10
- Autonomy: 6.6/10
- Agency: 7.0/10
- Personality continuity: 6.8/10
- Memory: 7.8/10
- World model: 5.9/10
- Social cognition: 6.9/10
- Verification: 2.9/10
- Mobile runtime: 6.2/10
- Maintainability: 5.4/10

## 50. Главные текущие слабости

Самая большая проблема больше не в отсутствии модулей. Основные слабости — доказательная поверхность, размер OrganismCore, отсутствие полноценного long-horizon world model, слабая offline imagination, отсутствие реального on-device device gate, и риск накопления исторического documentation debt. Вторая категория риска — memory/heap growth на долгих сценариях.

- Function Reality Closure.
- Core decomposition.
- World model.
- Long-horizon autonomy.
- Physical device benchmark.
- Evidence hygiene.

## 51. Что убрать или объединить

Следующие кандидаты на consolidation: duplicate state summaries, multiple action-bias functions, repeated diagnostics builders, repeated history snapshots, legacy release copies that duplicate evidence, and any new neural subsystem that claims ownership already held by B269/B290/B291/B292. Consolidation should prefer one owner + many adapters rather than multiple overlapping implementations.

- One owner per state.
- One owner per action decision.
- One persistence contract.
- One event lineage.

## 52. B294–B300: immediate plan

B294: function passport generator and replay scenarios. B295: Core decomposition phase 1. B296: event spine and causal lineage. B297: bounded world model. B298: selective imagination. B299: curiosity/compute budget. B300: first long-horizon autonomous campaign with deterministic replay.

- Each pass must add or raise evidence, not merely file count.
- Every pass ends with clean archive + clean unpack test.

## 53. B301–B320: cognition expansion

Следующая группа должна закрыть world-model latent state, temporal abstraction, episodic causal graph, social prediction, counterfactual planning, value conflict resolution, consolidation, memory pruning, emotional homeostasis and internally generated task loops. Neural circuits should be added only where current symbolic/continuous machinery cannot produce the required behavior or where a causal neural mechanism has a measurable advantage.

- World model.
- Planning.
- Social.
- Consolidation.
- Homeostasis.
- Neural specialization.

## 54. B321–B350: organism-level autonomy

Эта фаза должна перейти от «автономных шагов» к «автономной жизни»: self-authored agenda, persistent projects, resource trade-offs, exploratory behavior, social commitments, learning schedules, recovery, self-monitoring, and multi-hour replayable campaigns. Главная метрика — не количество responses, а diversity + coherence + persistence of self-generated behavior.

- Self-generated agenda.
- Long-lived commitments.
- Resource allocation.
- Recovery.
- Self-evaluation.

## 55. B351–B400: research-grade maturity

Эта фаза — переход к экспериментальной платформе, где разные neural mechanisms могут A/B тестироваться against the same organism benchmarks. На этом уровне проект должен поддерживать reproducible ablations, causal lesion matrices, capability passports, multi-seed learning studies, and regression dashboards.

- Ablations.
- Multi-seed experiments.
- Capability dashboard.
- Causal matrices.
- Longitudinal benchmarks.

## 56. Release gates

Каждый будущий release должен иметь minimum gates: typecheck, unit neural tests, core integration, restart/persistence, concurrency, UI/server, architecture, integrity, forensics, hygiene, contract, source truth, full audit, function reality delta and mobile profile. Long-horizon mobile and physical device testing should remain separate hard gates.

- No gate weakening for convenience.
- Unresolved gates must be explicit.
- Historical metrics cannot override current evidence.

## 57. Evidence model

Для каждого крупного утверждения должен существовать evidence triple: implementation -> behavioral test -> causal/longitudinal observation. Это устраняет основной риск decorative architecture. B293 удовлетворяет этому триплету для своего local neural circuit, но не для всего проекта.

- Implementation artifact.
- Automated behavioral test.
- Causal/longitudinal evidence.

## 58. Уникальная идея: neural grammar of the organism

Предлагается слой «нейронной грамматики»: не хранить только веса, а хранить набор проверенных переходов между состояниями организма как reusable motifs. Каждый motif содержит precondition, recurrent signature, expected consequence и plasticity policy. Организм может постепенно собирать собственный словарь когнитивных переходов. Это может стать более масштабируемым, чем ручное создание тысяч специализированных функций.

- Motifs are learned from verified chains.
- Each motif has a causal fingerprint.
- Broken motifs are automatically quarantined.

## 59. Уникальная идея: internal compiler

После достаточного evidence организм может компилировать доказанные chains в один fast path. Это позволяет сохранить сложность «мозга» на уровне поведения, а execution cost снижать на уровне телефона. При обнаружении prediction error compiled route временно отключается и заменяется на decomposed trace до повторной верификации.

- Fast path only for verified chains.
- Automatic rollback on error.
- Performance as a cognitive capability.

## 60. Уникальная идея: shadow organism + budget market

Комбинация двух идей особенно перспективна: lightweight shadow organism оценивает candidate actions, а cognitive budget market решает, сколько compute тратить на них. Получается система, способная самостоятельно выбирать depth of thought. Это может дать существенный прирост эффективности на телефоне и одновременно приблизить автономность к self-directed control.

- Cheap actions: direct.
- Uncertain actions: shadow simulation.
- High-impact actions: deeper planning.
- Exhausted budget: recover/consolidate.

## 61. Что считать «настоящим нейро» дальше

Для проекта настоящий neural element должен удовлетворять минимум пяти условиям: temporal internal state, discrete/event activity or equivalent dynamic state, recurrent interaction, learning rule, causal effect on downstream behavior. B293 проходит эти условия на локальном уровне. Будущие circuits следует вводить только при прохождении тех же criteria.

- State.
- Events/dynamics.
- Recurrence.
- Plasticity.
- Causal downstream effect.

## 62. Что считать «настоящей личностью» дальше

Личность должна быть наблюдаема по продольной траектории: preferences persist, identity survives interruption, values modulate action selection, self-narrative changes after important outcomes, and behavior remains coherent across contexts while still adapting. Single-turn style imitation не является достаточным evidence.

- Persistence.
- Consistency.
- Adaptation.
- Autobiography.
- Value-guided choice.

## 63. Что считать «самостоятельностью» дальше

Самостоятельность должна быть измеряема отсутствием постоянного внешнего prompt. Организм должен иметь внутренние goals, сам выбирать subgoals, оценивать trade-offs, решать когда спрашивать, когда исследовать и когда остановиться, а затем пересматривать свои стратегии на основе outcomes. B291+B292 уже создают основу для этого; B294+ должны дать длинный self-generated campaign.

- Self-generated goal.
- Self-generated subgoal.
- Self-evaluation.
- Resource arbitration.
- Persistence across sessions.

## 64. Финальный вердикт B293

B293 является реальным шагом вперёд, потому что добавляет причинно-проверяемый рекуррентный neural mechanism в существующий self/agency/intention stack и при этом исправляет собственную regression. Наиболее сильная часть релиза — не число новых файлов, а то, что новый neural circuit проходит standalone learning, lesion test, core integration, persistence и regression A/B. Наиболее слабая часть остаётся той же: огромная разница между breadth of implementation и strict behavioral verification, плюс нерешённый long-horizon mobile gate на host. Именно поэтому следующая фаза должна сместить центр тяжести к function reality, causal event lineage и world-model planning.

- B293 should be treated as validated integrated research build, not finished AGI.
- No claim of phenomenal consciousness.
- Next best step: B294 Function Reality Closure + event lineage.

## 65. Источники и внешний ориентир

Ниже перечислены первичные/официальные репозитории и страницы, использованные как архитектурные ориентиры. Они не входят в runtime и не являются доказательством работоспособности Neuro-Kurisu.

- NengoSPA: GitHub — semantic pointer architecture / cognitive spiking representations. https://github.com/nengo/nengo-spa
- Norse: GitHub — spiking neural network primitives on PyTorch. https://github.com/norse/norse
- Brian2: GitHub — flexible spiking neural-network simulator. https://github.com/brian-team/brian2
- DreamerV3: official GitHub — world models and imagined trajectories. https://github.com/danijar/dreamerv3
- Lava: GitHub — neuromorphic framework; repository currently archived. https://github.com/lava-nc/lava
