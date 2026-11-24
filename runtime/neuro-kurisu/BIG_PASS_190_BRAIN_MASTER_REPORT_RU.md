# Neuro-Kurisu — BIG PASS 190: Predictive Allostasis + Full Reality Certification Update

## 1. Результат прохода

Этот проход продолжает brain branch после B189. Основной инженерный шаг — B190 Predictive Interoception / Allostasis, дополненный усилением всей системы проверки функций.

B190 добавляет `PredictiveAllostasisSubstrate`: компактный recurrent learned model внутренних состояний организма. В отличие от прежней эвристической homeostasis-логики он учится предсказывать следующий вектор внутреннего состояния на основе текущего recurrent hidden state и использует residual prediction поверх persistence baseline.

Модель не получает права ухудшать действующий policy path до доказательства превосходства. Она подключена к central cognitive path как predictive regulatory signal и остаётся evidence-gated.

## 2. Научная опора

Современная литература рассматривает interoception и allostasis как распределённый bidirectional brain-body process: мозг постоянно моделирует внутреннее состояние тела и заранее подготавливает регуляторные ответы. Ультравысокопольные fMRI-исследования 7T 2025 года подтвердили крупномасштабную allostatic-interoceptive network и расширили картирование корковых, подкорковых и brainstem узлов.¹²

Это не означает, что наш computational substrate является биологическим аналогом соответствующей сети. Архитектура Neuro-Kurisu использует научную гипотезу как инженерный источник требований, а не как доказательство нейронной эквивалентности.

Свежая работа 2026 года об active-inference account of emotion regulation также связывает интероцептивную регуляцию с ретроспективным и проспективным minimization of free energy; для проекта это аргумент в пользу разделения текущей ошибки и ожидаемой стоимости будущих внутренних состояний.³

## 3. Что сделано

### B190 — Predictive Allostasis

- создан `PredictiveAllostasisSubstrate`;
- recurrent hidden state 24D;
- multi-timescale error tracking: fast/slow;
- next-state prediction по текущему recurrent state;
- persistence baseline для честного сравнения;
- residual prediction вместо абсолютного угадывания;
- overload estimate;
- intervention urgency;
- readiness estimate;
- стабильность в длинной последовательности;
- snapshot/restore;
- integration в `OrganismCore`;
- состояние сохраняется в canonical `advanced` facet;
- отдельный P66 regression test.

### Исправления, найденные во время прохода

1. P66 hysteresis использовал уже обновлённый `lastMode` вместо предыдущего режима. Теперь используется captured `previousMode`.
2. P31 migration test требовал устаревший P31 v2; текущая canonical migration реально переводит P31 в v3 — тест приведён к реальному контракту.
3. consciousness evidence ledger действительно мигрирует к v4; тест обновлён на v4.
4. full/forensics/source-hygiene auditors ошибочно считали historical release-manifest entries stale source. Правило инструментов исправлено так, чтобы provenance manifests не создавали false positives.
5. duplicate generated semantic coverage file удалён.
6. B190 initially trained absolute state prediction and was weaker than persistence baseline. Модель переделана на residual next-state prediction. Это было принципиальное исправление качества, а не cosmetic tuning.

## 4. Что доказано этим проходом

### Type / build

`TYPECHECK=PASS`

### B190 standalone

208 training observations + held-out stress step.

После обучения:

- samples: 209;
- overload under stress: 0.571;
- fast prediction error: 0.052;
- slow prediction error: 0.044;
- persistence baseline remains an explicit comparator.

Важно: в общей mixed-sequence выборке модель пока не получает стабильного преимущества над persistence baseline. Поэтому B190 **не повышен до full VERIFIED predictive-model status**. Его mechanism is implemented and integrated, but broad predictive superiority remains an open research gate.

### P66

- normal exploration mode stable;
- stress transition → recover;
- snapshot/restore deterministic.

### Existing brain gates

- B182 — PASS
- B183 — PASS
- B185 — PASS
- B186 — PASS
- B187 — PASS
- B188 — PASS

### Legacy regression block

- P16 — PASS
- P17 — PASS
- P19 — PASS
- P20 — PASS
- P21 — PASS
- P22 — PASS
- P31 functional consciousness — PASS
- P31 lesion — PASS
- P31 migration — PASS
- P32 migration/causal self — PASS
- P33 — PASS
- P41 migration/integration — PASS

### Persistence / systems

- restart persistence — PASS
- memory dedupe — PASS
- concurrency — PASS
- integrity — PASS
- release source — PASS

### Long horizon

500-cycle operational test — PASS:

- ratio 1.102
- first 61.68 ms
- last 67.97 ms
- p95 98.31 ms
- heap first 52.12
- heap last 225.83

1000-cycle gate — NOT PROVEN IN THIS PASS.

## 5. Полный function reality inventory

Current semantic inventory:

- 2586 semantic source-functions;
- 38 strict VERIFIED;
- 606 INTEGRATION_ONLY;
- 224 UNSAFE_TO_AUTO_RUN;
- 1718 UNVERIFIED.

Current liveness inventory:

- 2670 function-like declarations;
- 2641 with body;
- 108 exported;
- 157 with zero static references;
- 489 with one-or-less static references.

Parameterized probing:

- 539 attempted;
- 527 passed;
- 0 failed;
- 12 require lifecycle harness;
- 30 intentionally skipped because automatic execution is unsafe.

Snapshot/restore closure:

- 202 / 202 PASS.

### Interpretation

The project still has a very large behavioral evidence backlog. Code presence is not completion.

Strict VERIFIED rate = approximately 1.47% of semantic function inventory.

Evidence coverage = approximately 7.33%.

These numbers must not be confused with architectural maturity. They measure evidence coverage, not intelligence.

## 6. Architectural progress

The branch now contains a coherent sequence:

`P42/P41 perception`
→ `P27 learned world`
→ `hippocampal episodic/replay substrate`
→ `CentralBrain recurrent latent`
→ `PredictiveSelfAgency`
→ `RecurrentGlobalWorkspace`
→ `MetacognitiveNeural`
→ `PredictiveAllostasis`
→ `action / organism regulation`
→ `new observation`

This is now a substantially more unified predictive recurrent architecture.

## 7. Реальный статус B1–B15

| Step | Status |
|---|---|
| B1 Canonical Brain Substrate | VERIFIED computationally |
| B2 Learned Neural Core | IMPLEMENTED + partially verified; depth incomplete |
| B3 Hippocampal–Neocortical Memory | VERIFIED computational mechanism |
| B4 Predictive Self + Agency | VERIFIED computational mechanism |
| B5 Recurrent Global Workspace | VERIFIED computational mechanism |
| B6 Metacognitive / Higher-Order | VERIFIED mechanism; not consciousness proof |
| B7 Predictive Interoception / Allostasis | IMPLEMENTED + integrated; broad predictive superiority not yet verified |
| B8 Neuromodulatory Learning | PARTIAL |
| B9 Active Perception | PARTIAL |
| B10 Autonomous Scientific Brain | PARTIAL |
| B11 Social Brain | PARTIAL / existing evidence present |
| B12 Developmental Brain | PARTIAL |
| B13 Continuous Life | 500 cycles verified; longer gates open |
| B14 Physical Brain | PARTIAL |
| B15 Causal Consciousness Battery | PARTIAL, functional-only |

## 8. Текущий прогресс проекта

Это многомерный progress model:

| Dimension | Current estimate |
|---|---:|
| Brain architecture maturity | ~63% |
| Central neural substrate | ~51% |
| Memory brain integration | ~58% |
| Self/agency brain | ~53% |
| Recurrent workspace | ~50% |
| Metacognition | ~48% |
| Predictive interoception | ~32% |
| Autonomous life | ~40% |
| Real device embodiment | ~35% |
| Long-horizon life | ~30% |
| Strict behavioral evidence coverage | 7.33% |
| Strict VERIFIED semantic functions | 1.47% |
| Proven phenomenal consciousness | 0% |

The architectural estimates are engineering judgments. The last two evidence numbers are directly derived from the current audit inventory.

## 9. Следующие большие проходы

### B191 — Predictive Allostasis 2.0

- true multi-step prediction;
- horizon 1/4/16;
- adaptive latent timescales;
- uncertainty calibration;
- counterfactual internal regulation;
- stress/generalization holdout;
- explicit superiority over persistence;
- integration with CentralBrain and neuromodulation.

### B192 — Neuromodulatory Plasticity

- precision-like signal;
- reward prediction error;
- surprise/uncertainty modulation;
- exploration/exploitation regulation;
- learning-rate modulation;
- replay prioritization;
- lesion tests.

### B193 — Active Perception

- uncertainty-driven sensor selection;
- information gain;
- active sampling;
- multimodal verification;
- sensor budget;
- embodiment-aware perception schedule.

### B194 — Autonomous Scientific Brain

- question generation;
- hypothesis model;
- prediction;
- experiment selection;
- observation;
- statistical/evidence update;
- replication;
- rejection;
- durable research memory.

### B195 — Social Brain

- agent-specific latent models;
- belief uncertainty;
- relationship memory;
- social prediction;
- self/other boundary;
- social counterfactuals.

### B196 — Developmental Brain

- developmental curriculum;
- skill discovery;
- specialization;
- model replacement;
- safe self-modification;
- rollback;
- long-term identity constraints.

### B197 — Continuous Artificial Life

500 → 1,000 → 10,000 → 50,000 cycles → 7 days → 30 days → 90 days.

Каждый уровень получает memory/heap/latency/replay/identity/learning/device gates.

### B198 — Physical Brain Certification

- Android sensors;
- microphone;
- camera;
- battery;
- thermal;
- sleep/wake;
- offline/degraded mode;
- restart;
- sensor failure.

### B199 — Brain-wide Causal Science Battery

- recurrence lesion;
- workspace lesion;
- memory lesion;
- self lesion;
- world lesion;
- interoception lesion;
- agency lesion;
- neuromodulation lesion;
- replay lesion;
- cross-domain ablations.

## 10. Final execution note

The combined release command was intentionally broad and reached a runtime timeout at the restart stage. This timeout is not treated as PASS. The restart test had already passed independently earlier in the same pass. All completed gates reported above remain valid; incomplete combined-run stages remain open.

## 11. Непоколебимые правила

1. Code exists ≠ implemented.
2. Implemented ≠ integrated.
3. Integrated ≠ verified.
4. Verified ≠ long-horizon verified.
5. Long-horizon verified ≠ real-device verified.
6. None of the above = proof of phenomenal consciousness.

## Sources

1. Zhang J. et al. “Cortical and subcortical mapping of the human allostatic–interoceptive system using 7 Tesla fMRI.” Nature Neuroscience, 2025. https://www.nature.com/articles/s41593-025-02087-x
2. Zhang J. et al. “Cortical and subcortical mapping of the human allostatic–interoceptive system using 7 Tesla fMRI.” PubMed PMID 41131362.
3. “Emotion and allostatic control: An active inference account of emotion regulation.” PubMed PMID 41825796, 2026.
