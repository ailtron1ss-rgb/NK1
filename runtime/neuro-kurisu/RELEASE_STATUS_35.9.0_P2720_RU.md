# Neuro-Kurisu 35.9.0 / P2720 — Release Status

## Основной результат

P2720 — крупный интеграционный проход по lifelong neuroplasticity. Реализованы context-selective plasticity, local availability, sparse updates, action-conditioned residual model, adaptive temporal-delay policy, replay/counterfactual pressure и persistence.

## Фактический объём прохода

- Код: ~80% усилий прохода.
- Тесты/абляции/регрессии: ~13%.
- Research/docs/release evidence: ~7%.
- Новый production-код: `src/organism/cognition/P2720AdaptiveLifelongController.ts` + wiring в `NeuralExperienceBranch.ts`.
- Neural state schema: 20 → 21.
- Release: 35.8.1/P2716 → 35.9.0/P2720.

## Выполнение этого прохода

1. Context-selective state — DONE.
2. Per-neuron availability/selectivity/consolidation — DONE.
3. Sparse plasticity gate — DONE.
4. Adaptive plasticity multiplier — DONE.
5. Action-conditioned residual world model — DONE.
6. Adaptive 8-horizon delay policy — DONE.
7. Counterfactual/replay pressure wiring — DONE.
8. Micro neural path integration — DONE.
9. Full outcome integration — DONE.
10. Persistence/restart — DONE.
11. Regression + ablation battery — DONE.
12. Release/source-of-truth audit — DONE.
13. Mobile long-run optimization — PARTIAL; heap remains a debt.
14. Multi-context/interleaved/noisy/sparse-reward battery — NEXT.

## Latest evidence

`P2720_ADAPTIVE_LIFELONG=PASS outcomes=72 contextNovelty=0.0164 match=0.9817 sparse=0.2017 protected=0.2692 delayConf=0.9763 modelConf=0.7852 trajectoryDiff=9.3490 restartOutcomes=72`

`P2716_CONTINUAL_BATTERY=PASS expForgetA=0.0541 ctlForgetA=0.0668 expForgetB=0.0000 ctlForgetB=0.0027 interleave=0.0030 shift=0.0542 interference=0.0242 protected=0.2704 phase=stable delayConsensus=0.5604 trajectoryDiff=7.4267`

`P2716_MOBILE_SOAK_RESTART=PASS ticks=290 deepOutcomes=246 firstMedianMs=11.88 lastMedianMs=18.50 ratio=1.558 heapMB=334.2 persisted=1`

`P2708_LONG_HORIZON_CLOSURE=PASS warmedMedianRatio=1.455 firstMedianMs=12.51 lastMedianMs=18.20 p95Approx=216.16 heapGrowth=2.417`

## Audit

- TYPECHECK=PASS
- CLEAN_INTEGRITY=PASS
- CLEAN_ARCHITECTURE=PASS
- RELEASE_CONTRACT=PASS
- SOURCE_TRUTH=PASS
- FORENSICS=PASS
- ORGANISM_SMOKE=PASS
- SERVER_SMOKE=PASS
- API_ROUTES=110 / duplicates=0

## Limitations

P2720 demonstrates real state evolution and experimental/control trajectory separation. It does not establish consciousness or universal continual-learning superiority. The A→B→A improvement in this run must be reproduced across broader matched-control batteries.
