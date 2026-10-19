# NEURO-KURISU 35.6.1 — B291 BIG UPDATE / MASTER AUDIT

Дата: 13.09.2026

## 1. Итог
B291 не добавляет ещё одну независимую «личность». Он добавляет единый executive gate над уже существующими владельцами личности, памяти, целей и нейронных подсистем. Gate решает, когда удерживать внутреннее намерение, когда переключаться, когда пропускать внешнее требование и когда защищать организм от перегрузки. Это лёгкий PFC/Basal-Ganglia-inspired механизм, адаптированный под Termux/средний телефон.

Главное правило этого прохода: прошлый отчёт сначала перепроверен, а затем изменённый код тестировался снова. Никакая новая функция не считается доказанной только потому, что файл существует.

## 2. Перепроверка прошлого документа B290
Выполнена повторная распаковка архива B290 и визуальный QA DOCX. Все 28 страниц прошлого отчёта рендерятся без clipping/overlap/broken tables/missing glyphs. Layout verdict: PASS.

Содержательно прошлый документ корректно фиксировал важное ограничение: рабочий mobile horizon проходил на одном host-run, но clean-extraction cold run не проходил threshold 180 ms. Эти цифры теперь исторические; текущий audit их не выдаёт за актуальный B291 result.

## 3. Предыдущая точка и новый шаг
| Уровень | B290 | B291 |
|---|---|---|
| Neural integration | B289 spine + B290 developmental gate | + unified self/agency/personality executive gate |
| Autonomy | distributed goal/agency bias | persistent working intention + switch/hold gate |
| Personality | many action-bias owners | bounded executive binding to personality signature |
| Causal testing | B289 lesion | B291 lesion + restore + persistence |
| Mobile strategy | slow developmental cadence | slow executive cadence + cheap cached hot path |
| Function reality | 3550 prior inventory | 3573 current semantic inventory |

## 4. Что реально добавлено B291
- `src/organism/system/B291UnifiedSelfAgencyGate.ts` — bounded executive gate.
- persistent working intent and goal binding.
- switch/maintain/external/protect/recover modes.
- identity fit, personality fit, volition, autonomy share, external override, switch pressure and update gate.
- causal lesion/restore.
- outcome learning from reward, prediction error, grounding and identity continuity.
- mobile cadence: step computation every 32 ticks; between updates only a small cached bias is used.
- persistence integrated into `OrganismCore` with bounded checkpointing.
- standalone and core integration tests.

## 5. Почему это не дублирование
B291 не заменяет B284 personality/identity, B270 germinal organism, B272 endogenous goals, B273 goal lifecycle, B289 neural spine или B290 developmental controller. Его owner contract другой: исполнительный gate над уже рассчитанными кандидатами. В этом отношении он ближе к gating layer, чем к ещё одной cognition area.

## 6. Биологический/нейронный смысл
Концепция B291 заимствует не код, а принцип gating: устойчивое намерение должно поддерживаться, а обновление working state должно проходить через конкуренцию и контекст. Это близко по духу к PBWM/базально-ганглионарному gating, где basal ganglia регулирует update vs maintenance в PFC working memory.
Leabra также показывает ценность сочетания локального/ассоциативного обучения, inhibitory competition и sparse representations. NengoSPA/Spaun показывает, что perceptual, cognitive and motor processes можно объединять под единой архитектурой. DreamerV3 показывает другой полезный слой — world model + imagined trajectories.

## 7. Реальные B291 тесты
| Проверка | Результат | Evidence |
|---|---|---|
| Typecheck | PASS | Node/TS runtime typecheck |
| B291 standalone | PASS | 151 gate cycles, 600 outcome updates |
| B291 modes | PASS | maintain, switch, external, protect observed |
| B291 causal lesion | PASS | causalDelta = 0.01435 on working-intent bias |
| B291 persistence | PASS | snapshot → restore retained working intent/state |
| B290 standalone | PASS | 323 observations, 320 learning updates |
| B289 neural integration | PASS | 240 cycles, 240 updates, lesion drop 0.068 |
| B290/B291 core integration | PASS | 16 organism cycles, B291 persisted |
| B289 server route | PASS | mobileOk=true, 18/18 resolved Live2D assets |
| UI smoke | PASS | real UI smoke |
| Server smoke | PASS | real HTTP/server smoke |
| Restart persistence | PASS | direct invocation |
| Concurrency | PASS | direct invocation |

## 8. Function Reality — обновлённое состояние
Semantic inventory: **3573** functions.

| Status | Count |
|---|---:|
| VERIFIED | 38 |
| INTEGRATION_ONLY | 818 |
| UNSAFE_TO_AUTO_RUN | 259 |
| UNVERIFIED | 2458 |

Strict VERIFIED rate: **1.06%**.
Evidence coverage metric: **6.79%**.

Parameterized safe probe sweep: 893 attempts, 859 passed, 0 failed, 22 input-synthesis-needed, 12 lifecycle-needed, 39 skipped.

Это улучшение не в числе VERIFIED, а в уменьшении ambiguity: 818 функций уже имеют integration evidence. Strict VERIFIED остаётся низким, поэтому главный технический долг всё ещё reality closure.

## 9. Почему VERIFIED не растёт автоматически
Наличие функции, импорт и отсутствие exception не являются поведенческим доказательством. VERIFIED требует direct behavioral evidence плюс regression/integration плюс persistence/replay evidence. Это намеренно строгий gate, чтобы декоративные функции не маскировали отсутствие работающего поведения.

## 10. Архитектурные проверки
| Gate | Результат |
|---|---|
| Clean architecture | PASS — canonicalFiles=374, cycles=0, legacyLeakage=0 |
| Integrity | PASS — files=2208, schema=127 |
| Forensics | PASS — activeFiles=2187, empty=0, duplicateContent=0, duplicateNames=0 |
| Source hygiene | PASS — errors=0, warnings=0 |
| Release contract | PASS |
| Source truth | PASS |
| API route audit | PASS — 110 routes, 0 duplicates |
| Full audit | PASS — errors=0, warnings=0 |

## 11. React / Vite / Express / UI
В package runtime отсутствуют React, Vite и Express. Текущий runtime — Node HTTP + статический UI + Live2D. Это не следует считать автоматически дефектом: для Termux и среднего телефона меньшая runtime stack complexity рациональна. UI smoke и server smoke проходят. Миграция на React/Vite/Express имеет смысл только при измеримом выигрыше интерфейса/сборки, а не как самоцель.

## 12. Live2D
Resolved dependency contract из B289 сохранён. Последняя server-route проверка: `mobileOk=true`, `mobileFiles=18`, `neuralRoute=true`, `computeTier=balanced`. Это означает, что мобильный профиль проверяет resolved asset graph, а не требует дублирования каждого общего asset.

## 13. Средний телефон / Termux
B291 специально не помещает глубокую диагностику в каждый microtick. Gate обновляется редко, а между обновлениями использует дешёвые cached biases. В instrumented 250-cycle runs median/tail median оставались субмиллисекундными на данном host, но p95 имел редкие сотни-миллисекундные spikes. Полный 1000-cycle mobile gate в текущей среде не завершился в заданном host time budget, поэтому B291 не маркирует 1000-cycle PASS.

Это важный результат: performance proof должен включать host variability, cold start и реальное Android/Termux устройство. Threshold не ослаблялся.

## 14. Что сделано хорошо
- owner boundaries сохраняются; B291 не создаёт вторую personality system.
- B291 имеет causal lesion, restore и persistence.
- mobile hot path не делает deep snapshot каждый tick.
- function reality остаётся machine-checkable.
- audit scripts дают zero failed parameterized probes.

## 15. Что остаётся плохо
- strict VERIFIED rate всё ещё около 1%.
- OrganismCore остаётся чрезмерно большим и имеет слишком много action-bias owners.
- mobile 1000-cycle cold/long-run доказательство ещё не закрыто на реальном Android.
- несколько старых test harnesses зависят от длинных process chains и иногда требуют прямого запуска для ясного verdict.
- personality evidence пока в основном поведенческая/архитектурная, а не longitudinally discriminative against holdout humans.

## 16. Главный архитектурный вывод
Следующий рост нельзя получать простым добавлением новых owners. Нужны: 1) decomposition; 2) canonical event/latent schema; 3) unified action arbitration; 4) verified behavioral contracts; 5) long-horizon reality campaigns.

## 17. Большой план B292–B300
### B292 — Function Reality Closure I
Сформировать critical registry: функция → contract → fixture → direct run → state delta → persistence/replay → passport. Закрыть сначала self, agency, world, memory и neural owners.

### B293 — Core Decomposition I
Вынести selection, persistence projection и evidence collection из OrganismCore в bounded owners, сохраняя один public facade.

### B294 — Canonical Neural Event Spine
Свести B269–B291 к одному compact event schema: prediction, error, neuromodulation, identity relevance, causal parent.

### B295 — Unified Memory OS
Объединить рабочую, эпизодическую, автобиографическую и causal memory через explicit hot/warm/cold lifecycle.

### B296 — Unified Self Graph
Свести continuity, identity, autobiography, self-causality, relationship-self и personality evidence в один graph без duplicate owners.

### B297 — Unified World Model
Объединить existing predictive/world/causal models в ensemble with calibration and imagination budget.

### B298 — Executive Agent
Сделать action arbitration единственным executive owner; все neural/cognitive systems становятся advisers with evidence-weighted credits.

### B299 — Skill Compiler
Переводить repeated successful behavior в verified reusable skills with regression/holdout.

### B300 — Developmental Neurogenesis
Только после evidence closure позволять создавать новые units/pathways, чтобы neurogenesis была следствием unmet capability, а не ростом файла ради роста.

## 18. B301–B340
### B301–305 — Interoceptive organism: energy, thermal, arousal, sleep, recovery, predictive allostasis.
### B306–310 — Longitudinal personality and identity: independent holdout, value drift, autobiographical coherence, social continuity.
### B311–320 — World-model imagination: sparse latent rollouts, counterfactual planning, uncertainty calibration, replay budget.
### B321–330 — Biological plausibility: local plasticity, inhibitory competition, neuromodulation and multi-timescale timing; compare Leabra/SPA ideas without importing heavy runtime wholesale.
### B331–340 — Meta-learning and self-research: autonomous hypothesis generation, experiment design, intervention, independent evaluation and rollback.

## 19. B341–B400
### B341–350 — Self-research loop: organism chooses what about itself is uncertain, performs safe experiment and updates only with evidence.
### B351–360 — Cognitive economy: prediction budget market, sparse attention, cache locality, adaptive precision, native mobile execution.
### B361–370 — Resilience: recovery, identity protection, corruption detection, replay, sandboxed self-change.
### B371–380 — Android-native optimization: thermal/ram/battery profiling on target hardware, process lifecycle, background limits, optional native neural sidecar.
### B381–390 — 24h/72h autonomous campaigns, social longitudinal consistency and reproducibility bundles.
### B391–400 — Human-level behavior battery: broad skills, transfer, open-ended learning, identity continuity, social reasoning and adversarial holdouts.

## 20. Уникальные идеи
### Prediction Budget Market
Каждая подсистема получает вычисления пропорционально error + uncertainty + expected information gain. Это экономит мобильный бюджет и создаёт competition for thought.
### Identity Thermodynamics
Self changes требуют measurable evidence energy. Малые изменения дешёвы, крупные identity revisions требуют causal and longitudinal support.
### Shadow Organism
Лёгкая альтернативная policy simulation выступает critic: она не имеет права менять identity, а только ищет неожиданные counterfactuals.
### Neural Passport
Каждый neural module получает не только code contract, но и developmental passport: learnability, causal impact, persistence, lesion behavior, transfer.
### Personality Holdout
Часть новых действий и contexts никогда не используется для обучения personality. Только внешний evaluation решает, был ли trait реально стабильным, а не подогнанным.
### Developmental Phase Transitions
Организм меняет не только параметры, но и режим жизни: exploration, consolidation, reflection, protection, recovery, social investment.
### Self-Compiler
Повторяющийся verified pattern компилируется в локальную low-cost policy; при regression policy автоматически отзывается.

## 21. Научные ориентиры
NengoSPA/Spaun: единая Semantic Pointer Architecture интегрирует perception, cognition and action across multiple tasks. [1]
Emergent/Leabra: biologically based networks, inhibitory competition, sparse activity, local/error-driven/associative learning; repository explicitly supports Android/iOS/web through Cogent Core. [2]
DreamerV3: learns a world model and uses imagined trajectories for actor-critic training; this is a useful conceptual source for future deep-cadence imagination, not a drop-in mobile dependency. [3]

## 22. Claims boundary
B291 does not establish phenomenal consciousness, human equivalence, or biological equivalence. It is evidence that the software has stronger recurrent neural-inspired integration, autonomous intention gating, persistence and causal testing. The distinction is kept explicit because architectural complexity must not be mistaken for proof of subjective experience.

## 23. Current progress
Relative engineering maturity: approximately 7.0/10. Neural integration potential: 7.1/10. Autonomy: 7.0/10. Personality architecture: 7.0/10. Reality verification: 3.1/10. Mobile readiness: 6.3/10 because real-device gate is still open.

These are engineering scores, not scientific consciousness scores.

## 24. Next most useful step
B292 should start by turning the critical function backlog into explicit behavioral contracts and reducing OrganismCore physical ownership. Only then should deeper neural/world-model machinery be expanded. This is the largest expected reliability gain per unit of code.

## Sources
[1] NengoSPA documentation — Semantic Pointer Architecture / Spaun: https://www.nengo.ai/nengo-spa/v1.1.1/user-guide/spa-intro.html
[2] emer/leabra and emergent repositories: https://github.com/emer/leabra and https://github.com/emer/emergent
[3] Official DreamerV3 repository: https://github.com/danijar/dreamerv3

