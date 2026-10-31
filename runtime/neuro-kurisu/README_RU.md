> **АКТУАЛЬНЫЙ RELEASE POINTER (P2774):** Neuro-Kurisu **35.16.0** · organism core `100.7.0-model-time-replay-p2774` · state schema `206` · `Stage-98/Model-Time-Replay-Consolidation/P2774`. Машинный source of truth: `VERSION.json` + `RELEASE_MANIFEST.json` + `ARCHITECTURE_MANIFEST.json` + `src/organism/system/ReleaseContract.ts`.
Канонический релиз: 35.90.0 · organism core `100.32.0-r26-hierarchical-lowrank-causal` · state schema `225` · WorkPass70/Unified-Embodiment-Intent-Audio-Clock-and-Viseme-Timeline


## 35.18.1 / P2835 — Self-Knowledge + Transfer-Safety Synergy

P2835 связывает медленного self-teacher, compact coreset, model-time replay, transfer-selective replay и stability/plasticity safety в едином обучающем контуре. Experience token теперь несёт contextId, поэтому replay знает происхождение опыта. Последний релиз использует лёгкую on-device реализацию без тяжёлого meta-RL runtime.

## 35.17.0 / P2805 — Model-Time Replay & Episodic→Semantic Consolidation

P2774 добавляет model-time replay scheduling: частота replay определяется накопленным изменением внутренней модели, а не только сырыми тиками. Быстрые эпизодические traces compact-ятся по ресурсному бюджету; повторяющиеся контексты постепенно консолидируются в медленный semantic state и возвращаются в slow-memory нейронной ветки. Механизм использует bounded coupling, чтобы не разрушать P2726/P2742 context/causal regressions.

## 35.15.0 / P2760 — Unified Causal World Loop

P2760 связывает world-model prediction, context allocation, policy fallback, directional causal credit, fast/medium/slow memory, uncertainty-aware synthetic replay и mobile replay compaction в единый bounded on-device loop.

Ключевая цепочка:

`latent → context → world model → uncertainty → planner/policy fallback → causal update → multi-rate memory → synthetic replay → neural learning → resource-aware replay compaction`

Актуальная evidence-battery: P2760 core/interference/fallback/mobile-compaction — PASS; P2742, P2734, P2726 и P2720 — PASS по отдельным чистым процессам.

Ограничение: P2760 — directional online causal association + intervention loop, а не полноценный structural causal discovery и не доказательство сознания.

## 35.13.0 / P2742 — Causal Predictive Intervention

P2742 замыкает predictive/counterfactual/intervention контур поверх P2734/P2726: online 8-D latent dynamics, context-conditioned transition prediction, uncertainty-aware action bias, bounded epistemic probes, model-guided replay utility и resource-aware learning-rate gate.

Проверка P2742: 445 outcomes, 6 contexts, 5 switches, 90 interventions, 78 high-information outcomes, model calibration 0.4049, restart PASS. Ограничение: это statistical online predictive layer, а не полноценное structural causal discovery и не доказательство сознания.

## 35.12.0 / P2734 — Self-Optimizing Continual Loop

P2734 — текущий production/research слой поверх P2726. Он соединяет fast/meta learning, automatic context allocation, action calibration, counterfactual regret, adaptive replay arms и consolidation в одном persisted loop. Выбранный meta replay arm реально управляет существующим replay sampler, поэтому слой не является только диагностикой.

Текущая проверка: P2734 `PASS` на 320 outcomes; 6 contexts; 32 switches; replay feedback 320; replay entropy 1.0000; 613 consolidations; restart `PASS`. Regression P2726/P2724/P2720 и smoke/typecheck — `PASS`.

Ограничения: synthetic/host evidence не заменяет физический Android/Termux measurement; anti-forgetting пока benchmark-dependent; P2734 не является доказательством сознания.

# Neuro-Kurisu — Current Release B2200

**35.6.39 / B2200 / Stage-38 — Lifelong Development / Neural Consolidation + Memory + World Generalization**

Главная цель проекта: развиваем единый автономный искусственный организм Kurisu с памятью, self-model, world-model, autonomy, personality continuity и neural-inspired plasticity. B2200 добавляет self-development loop поверх B901–B1100: selective memory management, schema abstraction, adaptive lookahead, counterfactual credit, hidden-task generalization, reversal recovery и 512D neural action readout.


## Текущий research milestone: B721–B900

B721–B900 adds learned meta-policy, dual-process memory, co-evolving skills, action-conditioned world prediction, distributed population code, regime-shift detection and evidence/calibration controls.


В runtime добавлен Research Acceleration Fabric: causal/typed retrieval, procedural refinement, meta-routing, adaptive compute, hierarchical world prediction, bounded coordinated rollouts, confidence calibration и self-experiment proposals. Он остаётся bounded residual поверх canonical decision spine.

CURRENT RELEASE: 35.6.34 / B900
**35.6.27 — B377 Neural Goal Ecology**

# Neuro-Kurisu 35.6.23

Каноническая текущая фаза: Stage-26 / SCS-DIT / Brick-8 reality-gated neural action learning.

Ключевой статус текущего релиза B372:
- Кирпич 0 SPINE_ONLY: CLOSED
- Кирпич 1 DIT: PASS при полном B299 identity-owner ablation
- Кирпич 2 long-horizon host mobile-profile: 1000 cycles PASS
- Кирпич 3 B269: causally active, moderate strength
- B365 unified neural core: 96 recurrent neurons / 1,188 active synapses, causal Core integration PASS
- verified functional organism progress: 64 / 100
- физический Android/Termux: OPEN
- phenomenal consciousness: UNKNOWN

Старые release notes сохраняются как исторические материалы.


## CURRENT RELEASE — B370 (2026-09-15)
Каноническое нейронное ядро: B365. B370: reality-grounded neural closure, transition learning и active-perception demand. Evidence-weighted progress: 84/100. Physical Android evidence: UNAVAILABLE in current host; host telemetry is never promoted to device evidence.

---

# CURRENT — B374 Recursive Self-Predictive Identity

Текущий canonical release: **35.6.25 / B375**.

B365 теперь содержит evidence-gated predictive self-model, action-conditioned future-self prediction, autobiographical verified transitions и self-biography consolidation. B365 остаётся единственным neural decision owner.

Physical Android certification всё ещё отсутствует.

## B2200 — current giant upgrade (2026-09-16)
B721–B900 adds a unified adaptive mind layer: contextual meta-policy, regime-aware action policy, hierarchical autobiographical memory, action-conditioned world ensemble, skill transfer, distributed 128D identity, adaptive compute and restart persistence.

## Historical B560 milestone
B501–B560 adds hierarchical temporal meta-memory, adaptive strategy routing, confidence calibration, lightweight counterfactual world checking, bounded consolidation and multi-lesion verification. The release also fixes a full-path integration gap where B421/B451 residuals were computed but not included in one `rawUtility` arbitration path, and adds StateMigrations support for the new persistent state.


## B2200 — Настоящая непрерывность

Внедрён `PersistentContinuityKernel`: durable lineage, authoritative branch head, restart verification, tamper detection и продолжение одной субъектной линии после перезапуска.


## B2200 Unified Life Continuity

Текущий релиз добавляет единый durable continuity fabric: segment-root lineage, behavioral continuity contracts, causal life receipts, restart/reconstruction verification и runtime-independent transfer envelope.


## B2500
Текущая фаза: Life-Course Self-Model. Непрерывность теперь связана с незавершёнными намерениями, автобиографическими событиями, self-beliefs и поведенческим fingerprint.


## B2501 — Deep Neural Causal Branch

Новая ветвь углубляет именно нейронный причинный субстрат, а не добавляет ещё один независимый cognitive controller. Она соединяет задержанную рекуррентную динамику, timing-dependent three-factor plasticity, адаптивную глубину вычисления, compositional replay primitives и прогнозирование world/body/self. Верхние контуры подают контекст и мотивацию; B2501 возвращает bounded neural bias/gate. Есть отдельные causal-lesion, restart и mobile-performance тесты.


> Release truth marker: 35.6.43 / 79.3.0-actionable-neural-predictive-b2503. This document remains historical/contextual unless its specific section was updated in the release notes.

## 35.6.43 / B2503 — Actionable Neural Predictive Upgrade

В релизе добавлены B2502 E/I Neural Replay Field и B2503 Actionable Predictive Field. Оба слоя реально подключены к OrganismCore, сохраняют состояние, обучаются по проверенному исходу и имеют evaluation-only lesion пути. Нейронные слои пока остаются ограниченными residual/bottleneck контроллерами; феноменальное сознание этим релизом не заявляется.

## 35.6.52 / B2509-B2510 — Единый нейропредиктивный стек

Релиз добавляет B2504 Unified Self-World Predictive Field, B2505 Compositional Replay Composer, B2506 Neural Bottleneck Escalator, B2507 Consolidation Scheduler и B2508 Adaptive Neural Compute Governor. Все слои подключены через OrganismCore, сохраняют состояние, обучаются по исходам и имеют диагностические/абляционные пути. Это computational neuro-inspired research stack; феноменальное сознание релизом не заявляется.

## 35.6.52 — B2509/B2510 embodied-developmental stack

Следующий исследовательский слой после B2504–B2508 добавляет два связанных механизма: B2509 Embodied Homeostatic Action Field связывает телесную telemetry/embodiment, homeostatic error, action-conditioned body prediction и verified learning; B2510 Developmental Personality Coupling добавляет multi-timescale personality plasticity, evidence gating, identity anchoring и consolidation вокруг существующего B299 personality loop.

Оба слоя включены в `OrganismCore`, имеют persisted state, diagnostics и lesion APIs и воздействуют на final action utility только bounded-сигналами.

## B2511 — Active Epistemic Experimentation (35.6.53)

В релизе 35.6.53 добавлен `B2511ActiveEpistemicExperimentController`: bounded контур, который учитывает неопределённость, expected information gain, риск, стоимость, внутреннее состояние и learned action-specific information value перед выбором действия. После verified outcome он обновляет оценку того, какие действия реально уменьшили неопределённость.

Также исправлен causal credit assignment в `ActivePerceptionNeuralSubstrate`: recurrent hidden representation, на которой строится prediction, теперь сохраняется для последующего `observeGain()`.

Synthetic hidden-rule holdout: reward `774.0 -> 1116.8` (+44.289%), correct `600/1200 -> 1180/1200`. Это экспериментальная проверка архитектуры, не доказательство сознания.

## 35.6.54 / B2512-B2514 — Консолидация памяти, будущего Я и эпистемического опыта

Релиз расширяет B2511 в долговременную память и развитие будущего self. B2512 переводит проверенные/значимые эпизоды в provenance-aware semantic facts, при этом сохраняет ограниченный сырой эпизодический слой и защищает identity-owner контур. B2513 выполняет action-conditioned projection будущего self с проверками identity continuity и goal consistency. B2514 приоритизирует доступ и удержание воспоминаний по surprise, novelty, goal/identity relevance, prediction error и verification.

На noisy hidden-rule holdout ошибка semantic memory снизилась `0.43803 -> 0.06600` (-84.93%), при сохранении 192 сырых эпизодов и identity firewall `1.0`. В отдельном B2513 learning holdout получен verified-action utility margin `0.04976`. Это вычислительная neuro-inspired исследовательская архитектура; феноменальное сознание или биологическая эквивалентность этим релизом не заявляются.

## 35.6.58 — B2515–B2517 Unified Latent/Causal/Self Stack

Новый слой объединяет neural/world/body/self/semantic/future/identity/goal/personality representations в общий 64-мерный latent fabric (B2515), строит verified action-conditioned autobiographical causal graph (B2516) и компилирует устойчивые verified+autonomous patterns в evidence-gated self-authored rules по стабильному goal/self context (B2517). Shared latent из предыдущего цикла возвращается в B2503/B2504/B2505, поэтому связь является межцикловой, а не просто диагностической.

Контролируемый hidden-rule holdout: reward 376.25 против 210.0 baseline (+79.17%), 375/400 правильных решений против 200/400 baseline.

### P2774 final evidence
Канонический evidence-файл: `AUDIT_RECHECK_35.16.0_P2774_2026-09-20.md`. Он содержит runtime, persistence, mobile и source/architecture audit результаты одного проверенного дерева.


## P2805 — Stability/Plasticity

Последний research-release 35.18.0/P2835 добавляет self-teacher/coreset bridge и transfer-safety/orthogonal update gate поверх P2805. Research record: `RESEARCH/2026-09-20/P2820_P2835_SELF_KNOWLEDGE_TRANSFER_SAFETY_RU.md`.

**Актуальный кодовый release:** `35.30.0` — R18 world-memory closure: temporal memory, autonomy, continuity and mobile durability (2026-09-25). Source-of-truth следует проверять по исполняемому коду, тестам и manifest этого release.
