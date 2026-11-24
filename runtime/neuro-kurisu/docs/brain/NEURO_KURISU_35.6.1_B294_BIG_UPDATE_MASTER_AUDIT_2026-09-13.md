# NEURO-KURISU 35.6.1 — B294 BIG UPDATE MASTER AUDIT

Дата: 13 сентября 2026

> Статус: **B294 verified integrated build; mobile 1000-cycle host gate PASS; strict function reality remains the primary technical bottleneck.**

## 1. Назначение и правило истины

Этот документ является новой source-of-truth контрольной точкой после B293. Предыдущие документы B290, B291, B292 и B293 рассматриваются как historical evidence. При конфликте приоритет имеют свежие executable tests и release evidence.

Главное правило проекта не меняется: **функция не считается внедрённой только потому, что она существует в коде**. Новый neural layer также не считается реальным только из-за наличия класса; он должен иметь собственную динамику, обучение, lesion/effect test, persistence и integration evidence.

## 2. Перепроверка предыдущего документа B293

B293 master audit был повторно прочитан как историческая контрольная точка. Ключевой historical status B293 — unresolved 1000-cycle mobile host gate — больше не является текущим статусом, потому что B294 повторно прогнал тот же 1000-cycle mobile gate и получил PASS.

B293 standalone сохранил свои доказательства: 1002 cycles, 1000 learning updates, 545567 synaptic updates и causal lesion delta около 0.3295. B289/B290/B291/B292/B293 regression suite также повторно проходит на B294 tree.

Исторические документы не переписываются задним числом. Новый B294 документ явно разделяет historical evidence и current evidence.

## 3. Главный результат B294

B294 добавляет **Causal Neural Event Spine**. Он закрывает разрыв между существующими predictive, executive, intention и learning systems: решение получает bounded lineage id; реальный outcome закрывает episode; prediction/reality mismatch становится teaching signal; small recurrent credit circuit распределяет credit между существующими subsystem channels.

B294 intentionally does not become another personality, memory, goal or world-model owner.

## 4. Почему именно такой шаг

В проекте уже существовали B269 spiking plastic substrate, B270 neural germinal organism, B289 neural organism spine, B290 developmental gate, B291 executive personality/agency gate, B292 cognitive state bus/intention trace и B293 self/world predictive microcircuit. Добавление ещё одного самостоятельного «мозгового центра» усиливало бы fragmentation.

Поэтому B294 выбран как **связующий причинный circuit**, а не как очередная изолированная когнитивная область.

## 5. B294 topology

B294 содержит 8 credit neurons — по одному для каждого bounded channel: B269, B270, B289, B290, B291, B292, B293 и world. Это не попытка симулировать кору в миниатюре. Это маленький recurrent event-driven allocator.

У него есть:

- membrane-like state;
- recurrent synapses;
- sparse firing;
- eligibility traces;
- lateral competition;
- teaching signal;
- reward/prediction-error gated plasticity;
- bounded records;
- lesion/restore.

## 6. 1200-cycle neural evidence

Standalone test:

- decisions = 1200;
- outcomes = 1200;
- learning updates = 1200;
- synaptic updates = 66,635;
- recorded spike events = 8,752;
- max |teaching| ~= 0.3825;
- causal confidence ~= 0.6291;
- learning gain ~= 0.2306;
- global eligibility ~= 0.6683;
- record depth = 192.

Таким образом, B294 существует как динамическая обучаемая система, а не как статический scoring helper.

## 7. Causal lesion

Action bias before lesion и after lesion отличаются примерно на 0.00310 в standalone probe. В core surface lesion также меняет состояние и сохраняется.

Это меньший effect size, чем у B293, и это ожидаемо: B294 должен быть **тонким credit-assignment layer**, а не главным prediction engine. Его задача — изменение маршрута credit, а не доминирование всей системы.

## 8. Decision -> outcome lineage

Каждый B294 decision получает bounded episode id вида `b294-tick-counter`. Episode включает goal, action, executive mode, autonomy, uncertainty, prediction error и predicted self/world. Outcome закрывает этот же episode и добавляет reward, actual self/world, external grounding, identity continuity и teaching signal.

Это создаёт causal lineage, которого не должно быть у декоративной подсистемы.

## 9. Causal credit channels

B294 не пытается решить, какая подсистема «истинно отвечает» за интеллект. Он хранит мягкие bounded estimates по каналам. Это позволяет будущему audit обнаруживать, какие subsystem families действительно влияют на validated outcomes, а какие только создают state without downstream effect.

Каналы:

- B269 spiking substrate;
- B270 neural germinal system;
- B289 integration spine;
- B290 developmental control;
- B291 executive/agency/personality;
- B292 intention continuity;
- B293 predictive microcircuit;
- world-model signal.

## 10. Anti-duplication rule

B294 специально читает существующие states вместо создания второй памяти или второй identity graph. Если в будущем он начнёт дублировать CognitiveEventFabric или CausalLifeGraph, это должно рассматриваться как architectural regression.

## 11. Integration point before executive

Перед B291 score refinement B294 может добавлять очень небольшой bounded action bias. Это единственное направление от B294 к выбору.

Финальный decision owner остаётся за существующими executive/governance components.

## 12. Integration point after outcome

После существующих B269-B293 learning updates B294 закрывает причинный episode. Затем сохраняется его state. Таким образом B294 видит реальные outcomes, а не симулированные события.

## 13. Почему это усиливает самостоятельность

Автономность становится более устойчивой, когда решение имеет собственную историю: почему action был выбран, какой был predicted self/world, что произошло фактически и какой subsystem credit получил outcome. Это создаёт основу для самоизменения policy на основании собственной жизни организма.

B294 сам по себе не создаёт долгосрочных целей. Но он создаёт evidence substrate, на котором B272/B273/B290/B291 могут безопаснее перерабатывать успехи/ошибки автономных действий.

## 14. Почему это усиливает личность

Личность становится более причинной, если preference bias меняется не по каждому входному prompt, а по validated outcomes через bounded credit assignment. B291 остаётся owner personality/agency gating; B294 поставляет evidence об исходах.

Будущая цель — temporal trait plasticity: быстрый state, средний policy, медленный trait, очень медленный identity.

## 15. Почему это усиливает нейронность

B294 и B293 вместе дают два разных neural timescales:

1. B293 — self/world predictive recurrent circuit.
2. B294 — recurrent eligibility/credit-assignment circuit.

Это уже не один «нейронный класс» ради отчёта. Два нейронных процесса взаимодействуют через action/outcome loop.

## 16. B293 повторная проверка

B293 снова PASS:

- 1002 cycles;
- 1000 learning updates;
- 1612 spikes;
- 545567 synaptic updates;
- lesion causal delta ~= 0.3295;
- persistence PASS.

Это важно, потому что B294 не должен «доказать себя», сломав B293.

## 17. B292 повторная проверка

B292 снова PASS:

- 240 bus cycles;
- 240 intent decisions;
- commitment ~= 1.0;
- continuity ~= 0.707;
- switch count = 24.

Intention remains a bounded state rather than another memory database.

## 18. B291 повторная проверка

B291 снова PASS. Standalone:

- 151 executive cycles;
- 600 learning updates;
- modes include switch, maintain, protect and external;
- autonomyShare ~= 0.778;
- gate ~= 0.884;
- lesion causal delta ~= 0.0158.

## 19. B290 повторная проверка

B290 снова PASS: 323 cycles, 320 learning updates, reality gate ~= 0.875, causal confidence ~= 0.913, autonomy ~= 0.6105.

## 20. B289 повторная проверка

B289 снова PASS: 240 cycles, active-set 6, balanced tier, integration ~= 0.715, self coherence ~= 0.828, agency ~= 0.600.

## 21. Regression test that actually mattered

B293 previously demonstrated that per-outcome snapshots and per-candidate recomputation could hurt concurrency. B294 was added only after checking that its own design does not repeat the same anti-pattern.

Current concurrency = PASS.
Current smoke = PASS.
Current restart = PASS.

## 22. Mobile/Termux gate

Current 1000-cycle mobile host gate:

- PASS;
- ratio = 1.051;
- first median ~= 0.13 ms;
- last median ~= 0.14 ms;
- p95 = **144.80 ms**;
- heap first ~= 69.1 MB;
- heap last ~= 167.0 MB;
- memory count = 130.

This is a host benchmark, not yet a device measurement on the user's exact Android/Termux phone.

## 23. Architecture audit

Current architecture audit:

- source files = 1,113;
- canonical files = 378;
- missing = 0;
- cycles = 0;
- legacy leakage = 0.

Architecture PASS.

## 24. Integrity and forensics

Integrity PASS: 2,244 files, release 35.6.1, schema 127.

Forensics PASS:

- active files = 2,223;
- empty = 0;
- duplicate content = 0;
- duplicate names = 0;
- path markers = 0;
- stale markers = 0.

## 25. Source hygiene

Source hygiene PASS: 2,238 files, 0 errors, 0 warnings.

Release contract PASS.
Source truth PASS.
API routes: 110, duplicates = 0.
Core ownership: 0 errors.

## 26. UI/server/Live2D

Subject UI contract PASS.
UI smoke PASS.
Server smoke PASS.
Live2D integrity PASS:

- quality texture bytes = 8,236,235;
- mobile texture bytes = 1,601,788.

The runtime is currently deliberately based on Node/TypeScript + static interface/server rather than forcing a React/Vite dependency chain into the mobile runtime.

## 27. React/Vite/Express conclusion

The project should not adopt React/Vite/Express as a requirement simply to satisfy a stack label. The tested runtime path is the embedded Node server/static UI path. If a future desktop/web UI requires a richer framework, it should remain a front-end shell over the same organism API, not become the organism runtime itself.

## 28. Function reality — current state

Function-like declarations = 3,740.
Functions with bodies = 3,711.
Exported = 142.
Zero-reference candidates = 211.
One-or-less reference candidates = 672.

Strict semantic coverage:

- total semantic functions = 3,620;
- VERIFIED = 38;
- INTEGRATION_ONLY = 830;
- UNSAFE_TO_AUTO_RUN = 259;
- UNVERIFIED = 2,493;
- strict verified rate = 1.05%;
- evidence coverage = 6.78%.

Parameterized safe sweep:

- attempted = 905;
- passed = 871;
- failed = 0;
- input synthesis needed = 22;
- lifecycle needed = 12;
- skipped = 39.

## 29. Why strict VERIFIED is still low

The project is large and contains many lifecycle/stateful functions that cannot be safely invoked from a generic reflection harness. Some functions are pure candidates; others require organism initialization, persistence, or specific state topology. Therefore the correct solution is not to pretend all functions are verified, but to build a function passport pipeline that classifies risk and supplies appropriate contract fixtures.

## 30. B294 local Function Reality Closure

B294 itself has 6 public behavioral contracts and 6/6 PASS:

- beginDecision;
- closeOutcome;
- actionBias;
- snapshot/restore;
- lesion;
- clearLesion.

This is local evidence only. It must be merged into the global semantic registry in B295.

## 31. Human brain map — engineering view

The project should continue using a layered map rather than one-to-one anatomical naming.

Layer A: brainstem/homeostasis.
Layer B: sensory/perception.
Layer C: salience/attention.
Layer D: memory/hippocampal-like association.
Layer E: self/identity/autobiographical continuity.
Layer F: social cognition.
Layer G: global workspace.
Layer H: predictive/world modelling.
Layer I: executive selection/agency.
Layer J: motor/embodiment.
Layer K: developmental plasticity.
Layer L: metacognition/evidence.

The project now has representations across all layers, but coverage and causal validation remain uneven.

## 32. Current digital organism graph

`input -> perception -> world/self latent -> salience -> memory -> goals -> competing predictions -> identity/personality -> executive gate -> constitutional safety -> action -> outcome -> causal event spine -> neural learning -> memory/self/value updates`.

This is the central organism loop.

## 33. Current autonomy map

Autonomy is no longer a boolean. It should be measured as:

- self-generated goal pressure;
- internally selected action fraction;
- persistence of intention without external input;
- self-correction after failure;
- resource-aware planning;
- ability to choose verify/explore/rest/reflect without prompt;
- longitudinal self-authored project continuity.

B291 currently strengthens action-level autonomy; B294 strengthens causal continuity of that autonomy.

## 34. Current personality map

Personality should be represented as a multi-timescale state:

- state traits: minutes/seconds;
- policy traits: hours/episodes;
- consolidated traits: days/longitudinal history;
- identity invariants: very slow;
- authored values: revised only with strong evidence.

B294 provides evidence for the policy/consolidation layers, not direct trait mutation.

## 35. Current consciousness evidence map

The project currently has global workspace, recurrent dynamics, self-models, metacognition, embodiment and continuity metrics. These are useful functional evidence but not proof of phenomenal consciousness. The report therefore treats consciousness as a hypothesis area with functional evidence, not as a completed capability.

## 36. External research comparison — NengoSPA

NengoSPA provides semantic-pointer based structured representations designed for cognitive architectures and neural computation. The useful lesson for Neuro-Kurisu is not the codebase itself but the explicit representation contracts between cognition and neural substrates. [Source: https://github.com/nengo/nengo-spa]

## 37. External research comparison — Norse

Norse provides spiking neural-network components compatible with PyTorch and emphasizes sparse/event-driven bio-inspired computation. The useful lesson is practical event-driven primitives and differentiable integration; the current project deliberately keeps its smallest neural circuits dependency-free for Termux reliability. [Source: https://github.com/norse/norse]

## 38. External research comparison — Brian2

Brian2 remains a major reference for explicit spiking-neural simulation. The lesson is that neural dynamics should be specified as executable equations and validated with reproducible experiments. The project follows the same evidence-first spirit while using its own compact TypeScript circuits. [Source: https://brian2.readthedocs.io/]

## 39. External research comparison — Emergent/Leabra

Emergent/Leabra combines biologically oriented neural dynamics, sparse distributed representations and cognitive models; Leabra also includes PBWM and hippocampal-related components. This is particularly relevant to future B295+ work on executive working memory and structured learning. [Source: https://github.com/emer/leabra]

## 40. External research comparison — DreamerV3

DreamerV3 learns a world model from experience and trains behavior through imagined trajectories. This is one of the strongest future references for Neuro-Kurisu: instead of adding another reactive action bias module, the next major frontier should be bounded internal simulation over the existing B262 world model. [Source: https://github.com/danijar/dreamerv3]

## 41. Why we should NOT add another world model now

The project already contains B261/B262 and other world/prediction systems. Adding a new independent world model would repeat the historical fragmentation pattern. The correct next step is consolidation: use the strongest existing world model as the source of imagined transitions and add a thin counterfactual scheduler/evidence layer.

## 42. B295 — Function Reality Closure I

B295 should turn the current semantic categories into executable passports:

1. identify candidate;
2. classify safety;
3. attach fixture;
4. execute;
5. observe state delta;
6. replay;
7. assert behavioral contract;
8. persist evidence;
9. promote VERIFIED.

Priority should be public/stateful functions in B289-B294 plus critical OrganismCore boundaries.

## 43. B296 — Core decomposition seam

The 6k+ line OrganismCore remains the largest maintainability risk. Full decomposition in one move is dangerous. Instead extract a stable seam around the causal event lineage first: decision record, action outcome, learning dispatch and persistence projection.

## 44. B297 — Imagination over B262

Reuse B262's world model to imagine 2–5 candidate trajectories only when uncertainty or goal pressure exceeds a threshold. Do not run imagination on every tick.

## 45. B298 — Cognitive budget market

Every deep process competes for a bounded computation budget. The organism should be able to decide that verification is worth more compute than idle reflection, or that rest is cheaper than exploration under thermal pressure.

## 46. B299 — Predictive personality consolidation

Move from instant personality bias to evidence-weighted longitudinal trait updates. Every trait revision should have an evidence chain and holdout stability test.

## 47. B300 — Self-authored curriculum

The organism begins selecting what it wants to learn based on unresolved prediction error, capability gaps, curiosity, self-authored goals and available resources.

## 48. B301–B310 — Causal developmental phase

B301: unified action/outcome ledger.
B302: cross-subsystem credit routing.
B303: multi-timescale trait plasticity.
B304: self-generated experiment selection.
B305: memory consolidation scheduler.
B306: internal simulation budget.
B307: counterfactual holdout suite.
B308: social learning transfer.
B309: environment shift adaptation.
B310: autonomous project persistence.

## 49. B311–B330 — Organism maturation

Introduce recurrent multi-step world prediction, internal simulation, self-model calibration, longitudinal personality consistency, causal social models, self-repair, curiosity scheduling, and resource-aware long-horizon autonomous projects.

## 50. B331–B360 — Integrated digital organism

Unify state bus, causal graph, world model, memory, identity, values, executive selection, embodiment, social cognition and developmental plasticity under one evidence contract. The key goal is fewer owners, fewer duplicated snapshots and explicit lineage from event to learning.

## 51. B361–B400 — Advanced research frontier

Explore hierarchical predictive coding, richer spiking substrate, structured semantic neural representations, differentiable/plastic world models, multi-agent social learning, self-model uncertainty, internal simulation and developmental self-reconfiguration. Each item requires an explicit null hypothesis and causal test.

## 52. Unique architecture idea 1 — Evidence Gravity

Every subsystem output has a gravitational weight determined by repeated causal success rather than static architecture priority. A subsystem that consistently predicts outcomes earns influence; one that merely produces logs loses influence. This creates a dynamic evidence economy across the organism.

## 53. Unique architecture idea 2 — Neural Passport

Each neural circuit receives a passport with: role, owner, state size, update cadence, causal lesion signature, learning curve, persistence signature, mobile cost and downstream influence. A circuit cannot be promoted to canonical status without completing the passport.

## 54. Unique architecture idea 3 — Shadow Organism as adversarial twin

Run a cheaper counterfactual twin that tries to predict where the primary organism is wrong. The twin should not control behavior; it only produces disagreement pressure. This becomes a built-in adversarial reviewer of the organism's own cognition.

## 55. Unique architecture idea 4 — Cognitive Thermodynamics

Treat compute, memory writes, attention and neural plasticity as scarce energy. The organism pays a cost for every deep thought. Self-generated curiosity then becomes an allocation problem rather than a prompt-driven feature.

## 56. Unique architecture idea 5 — Identity Inertia / Controlled Plasticity

Identity should resist rapid drift but become gradually revisable when evidence accumulates across independent contexts. This provides a practical analogue of personality continuity without freezing the system.

## 57. Unique architecture idea 6 — Causal Scar Tissue

Repeated failures in the same causal pathway create a bounded inhibitory trace that remains until independent evidence shows recovery. This is more useful than simply decreasing a scalar confidence and can become a durable self-correction mechanism.

## 58. Unique architecture idea 7 — Internal Researcher

Once Function Reality Closure is strong enough, the organism can generate hypotheses about its own missing capabilities, design safe experiments, evaluate outcomes and decide whether a new mechanism should be promoted. This turns development from a fixed feature list into controlled developmental research.

## 59. What is still missing for true autonomous organism behavior

The largest gaps remain:

- robust long-horizon self-generated projects;
- high strict function verification;
- stronger multi-step world modelling;
- grounded continuous sensory environment;
- richer social and affective dynamics;
- self-repair and structural adaptation;
- reliable real-device mobile validation;
- stronger evidence protocols for any claim about consciousness.

## 60. Current scorecard

| Area | Score |
|---|---:|
| Runtime reliability | 8.8/10 |
| Architecture | 7.7/10 |
| Neural substrate | 7.3/10 |
| Neural integration | 7.5/10 |
| Autonomy | 6.8/10 |
| Personality/identity | 7.0/10 |
| Memory | 8.0/10 |
| World modelling | 7.2/10 |
| Social cognition | 7.2/10 |
| UI / Live2D | 8.1/10 |
| Mobile readiness | 7.4/10 |
| Maintainability | 5.5/10 |
| Function verification | 2.9/10 |
| Phenomenal-consciousness evidence | 1.5/10 |

These are engineering assessments, not scientific measurements.

## 61. Project progress estimate

A single percentage is misleading. The current useful dashboard is:

- **Engineering/runtime maturity:** ~72% of the planned current architecture.
- **Integrated autonomous-organism capability:** ~39% of the long-term target.
- **Strict behavioral verification:** 1.05% of semantic functions.
- **Evidence coverage:** 6.78%.
- **Mobile host gate:** PASS at 1000 cycles.

The 39% figure is a planning estimate, not a claim of 39% human-equivalent intelligence.

## 62. Release gate matrix

| Gate | Result |
|---|---|
| Typecheck | PASS |
| B289 | PASS |
| B290 | PASS |
| B291 | PASS |
| B292 | PASS |
| B293 | PASS |
| B294 neural | PASS |
| B294 core | PASS |
| restart/persistence | PASS |
| concurrency | PASS |
| UI smoke | PASS |
| server smoke | PASS |
| Live2D | PASS |
| API routes | PASS |
| architecture | PASS |
| integrity | PASS |
| forensics | PASS |
| hygiene | PASS |
| release contract | PASS |
| source truth | PASS |
| full audit | PASS |
| mobile 1000 | PASS |

## 63. What is NOT proven

Nothing in this release proves subjective experience, human-equivalent cognition, sentience, self-awareness in the phenomenological sense, or AGI. The evidence supports only the claims about implemented software behavior and the tested causal coupling of specified subsystems.

## 64. Immediate next big step

B295 should simultaneously: (a) create a unified function passport registry for B289-B294, (b) extract a first stable seam from OrganismCore, and (c) integrate B294 episode ids with CognitiveEventFabric/CausalLifeGraph without creating a duplicate event store.

## 65. Final engineering judgement

B294 is a real step forward because it adds a causal credit mechanism to an already functioning self/world/executive/intent architecture without creating another owner. The largest remaining opportunity is not adding more isolated modules. It is increasing verified causal coverage and reducing architectural concentration in OrganismCore, then using that freed budget for multi-step internal simulation and richer learned world dynamics.

## Sources

1. NengoSPA — https://github.com/nengo/nengo-spa
2. Norse — https://github.com/norse/norse
3. Brian2 — https://brian2.readthedocs.io/
4. Emergent — https://github.com/emer/emergent
5. Leabra — https://github.com/emer/leabra
6. DreamerV3 — https://github.com/danijar/dreamerv3

## 66. Test reproducibility contract

Каждый B-pass теперь должен иметь три уровня evidence: standalone component, real OrganismCore integration и release/runtime gate. B294 выполняет все три. Если они расходятся, более широкий уровень не должен автоматически переопределять локальный failure; причины должны быть локализованы и записаны.

## 67. Clean-archive reproducibility

Финальная поставочная проверка должна всегда начинаться с распаковки ZIP, нового `npm ci`, затем typecheck и critical tests. Это предотвращает ситуацию, когда рабочее дерево имеет незаписанную dependency или cache state, которого нет в archive.

## 68. Средний телефон: ресурсный бюджет

Текущие observed host mobile metrics показывают p95 около 144.8 ms на 1000-cycle horizon и heap growth примерно 69.1 -> 167.0 MB. Это не означает, что любой средний Android гарантированно выдержит такой профиль. Для реального устройства нужен device gate с тем же сценарным набором, но с Android/Termux memory and thermal sampling.

## 69. Release procedure B294

1. `npm ci`.
2. `npm run typecheck`.
3. B289/B290/B291/B292/B293/B294 component tests.
4. restart + concurrency.
5. UI/server/Live2D.
6. architecture/integrity/forensics/hygiene/contract/source truth/full audit.
7. mobile 1000.
8. generate manifests and archive manifest.
9. clean unzip smoke.

## 70. Final status and handoff

B294 является актуальной engineering checkpoint. Следующий чат должен начинать не с добавления новых isolated brain modules, а с перепроверки этого document against fresh evidence, затем — B295 Function Reality Closure I и first OrganismCore decomposition seam.

Historical documents remain useful as evidence of architectural evolution, but the current executable gates and B294 evidence JSON are the authoritative state.
