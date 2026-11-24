# BIG PASS 220 — Hypothalamic Homeostasis / Allostatic Resource Control

## Цель
B220 добавляет не буквальную копию гипоталамуса, а функциональный allostatic controller: организм оценивает внутреннее состояние, предсказывает ближайший вычислительный спрос и заранее ограничивает compute/plasticity при ресурсоопасных состояниях.

## Реальный прогресс
- `HypothalamicHomeostasisController` добавлен как persistent system layer.
- Energy reserve, thermal stress, allostatic load и predicted demand объединены в единый ресурсный state.
- Добавлены `computeCap01` и `plasticityCap01`, которые реально влияют на coordinator.
- Добавлены `recoveryDrive01`, `restorativePriority01`, `motivationDrive01`.
- Predicted demand обновляется медленно, поэтому контроллер способен к anticipatory/allostatic поведению, а не только реактивному throttling.
- B219 brainstem scheduler получает усиленный recovery/safety signal от homeostasis.
- Состояние сохраняется через OrganismCore checkpoint/restart.

## Causal evidence
Healthy: compute cap `0.861386784`, plasticity cap `0.862591104`, restorative priority `0.14245747456`.
Stressed: compute cap `0.24831724992`, plasticity cap `0.25529745152`, restorative priority `0.8729968368128`, allostatic load `0.798197984`.
Anticipatory high-demand step raised predicted demand to `0.4127422592`.
Coordinator integration: normal compute cap `0.8656812`, overload `0.256379936`; brainstem compute `0.88 -> 0.18`.
Persistence: controller ticks restored `3`; coordinator homeostasis ticks restored `2`.

## Regressions
B208–B220 all pass. B219 retains active compute `1.0`, sleep compute `0.18`, sleep plasticity `0.14`, sleep consolidation `0.6793768784`.

## Engineering interpretation
The useful abstraction is resource-aware allostasis: reserve computation and plasticity before resource exhaustion. This is not a claim of biological equivalence and is not a measurement of physical Android battery savings. Device-level energy savings require separate hardware measurements.

## Scientific framing
Recent reviews describe hypothalamic and brainstem systems as distributed controllers integrating peripheral/internal state with behavior and energy expenditure; modern work also emphasizes allostatic anticipation of energetic needs. B220 uses these principles as computational design inputs while keeping the implementation explicitly synthetic.
