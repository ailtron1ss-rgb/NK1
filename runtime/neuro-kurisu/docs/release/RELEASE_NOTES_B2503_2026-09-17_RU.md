# Neuro-Kurisu 35.6.43 — B2503 Actionable Neural Predictive Release

Дата: 2026-09-17
Application: `35.6.43`
OrganismCore: `79.3.0-actionable-neural-predictive-b2503`
State schema: `172`

## Что реально добавлено

### B2502 — E/I Neural Replay Field
- отдельный recurrent neural field: 40 excitatory + 8 inhibitory units;
- разреженная входящая индексация синапсов для горячего пути;
- delayed recurrent dynamics;
- E/I interaction, spike-like events и homeostatic activity signal;
- eligibility + outcome-gated plasticity;
- action-conditioned prototypes;
- bounded replay buffer и bounded prototype store;
- action bias + neural utility + action gate;
- persistence, restore и lesion path;
- интеграция в раннее и полное decision path `OrganismCore`.

### B2503 — Actionable Predictive Field
- action-conditioned transition field;
- multi-step imagined rollouts;
- uncertainty / calibration / information-gain estimates;
- counterfactual spread;
- verified-outcome learning;
- bounded residual influence на executive policy;
- persistence, restore и evaluation-only lesion path;
- интеграция в раннее и полное decision path `OrganismCore`.

## Причинная цепочка

`perception/body/world/self -> B365 -> B2501 -> B2502 E/I/replay -> B2503 predictive rollouts -> bounded action utility/gates -> executive policy -> real outcome -> prediction error -> plasticity/replay -> future decisions`

B2502/B2503 не являются автономной «магической заменой» executive policy. Их влияние ограничено, измеримо и абляционно проверяемо.

## Фактические проверки

- `TYPECHECK=PASS mode=tsc`
- `CORE_OWNERSHIP=PASS errors=0`
- `CLEAN_ARCHITECTURE=PASS sourceFiles=1387 canonicalFiles=422 missing=0 cycles=0 legacyLeakage=0`
- `FORENSICS=PASS activeFiles=3041 empty=0 duplicateContent=0 duplicateNames=0 pathMarkers=0 staleMarkers=0`
- `SOURCE_HYGIENE files=3056 errors=0 warnings=0`
- `CLEAN_INTEGRITY=PASS files=3062 release=35.6.43 core=79.3.0-actionable-neural-predictive-b2503 schema=172`
- `RELEASE_CONTRACT=PASS`
- `RELEASE_SOURCE=PASS application=35.6.43 core=79.3.0-actionable-neural-predictive-b2503 schema=172`
- `SOURCE_TRUTH=PASS`

### B2502 direct causal test
`B2502_EI_REPLAY_PASS`

6 seeds; minimum lesion effect ≈ `0.01408`; learning updates ≈ `44k–47k` per seed; prototypes `3` after consolidation; replay buffer `24`; sparsity snapshots `0.775–0.938`; repeated prototype hits are now exercised explicitly.

### B2503 direct causal test
`B2503_ACTIONABLE_PREDICTIVE_PASS`

61 cycles; 60 learning updates; 1281 rollouts; 28 learned transitions; prediction error `0.331`; uncertainty `0.496`; calibration `0.641`; causal lesion effect `0.153`; horizon `3`.

### Runtime causal integration
`B2503_RUNTIME_CAUSAL_PASS`

B2502 on: 6 cycles / 355 learning updates / 15 replay steps.
B2503 on: 6 cycles / 6 learning updates / 84 rollouts.
With both disabled: 0 B2502 cycles and 0 B2503 cycles.

### Mobile-oriented microbenchmark
`B2503_MOBILE_PERFORMANCE_PASS`

Combined B2502+B2503 host benchmark: p50 ≈ `0.095 ms`, p95 ≈ `0.29 ms`, max ≈ `0.29 ms`, heap ≈ `9.74 MiB`.

Это benchmark среды разработки/контейнера, а не физического Android-телефона.

### Synthetic holdout

Base: mean reward `0.27576`, accuracy `0.126`.
B2502: mean reward `0.33352`, accuracy `0.202`.
B2503: mean reward `0.43232`, accuracy `0.332`.
Combo: mean reward `0.43232`, accuracy `0.332`.

Вывод: B2502 теперь даёт самостоятельный измеримый прирост, а B2503 остаётся сильнейшим одиночным слоем на этой задаче. Простое сложение B2502+B2503 дополнительного выигрыша над B2503 не дало. Это важный отрицательный результат, поэтому синергия не объявляется доказанной.

## Ограничения

1. B2502 — вычислительный E/I recurrent substrate, а не биологическая нейросеть.
2. B2503 — bounded predictive transition field, а не полноценная differentiable world model.
3. Нейронные слои ещё не являются единственным decision bottleneck.
4. Нет физического Android sensorimotor benchmark в этом релизе.
5. Никаких выводов о феноменальном сознании из этих тестов делать нельзя.
6. Прототипная консолидация теперь реально повторно используется в synthetic holdout (483 hits/500 cycles в B2502-only, 487 hits/500 в combo); однако короткий runtime smoke даёт пока 0 hits, поэтому temporal/context coverage в runtime ещё недостаточен.

## Следующий исследовательский приоритет

B2504: self/world/body predictive field с совместным interoceptive/exteroceptive state, causal interventions и uncertainty-aware controller.
B2505: compositional replay + strict holdout generalization.
B2506: controlled neural bottleneck escalation с прогрессивным уменьшением bypass executive policy.
B2507: awake/rest/deep consolidation scheduler.
B2508: adaptive compute по uncertainty/energy/thermal budget.
B2509: Android sensorimotor embodiment.
B2510: developmental personality coupling.
