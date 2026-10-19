# Design decisions P2559–P2566

1. Не заменять B2521 одним махом; сначала внедрить новый actionable latent bridge как bounded residual и сравнивать его с B2521.
2. Не считать `interventionComparisons` причинным эффектом; причинный metric теперь требует matched context + different action + realized reward difference.
3. Не делать память полностью synchronous: sensor freshness и ageTicks входят в epistemic gate.
4. Не активировать все нейроны постоянно: activeNeuronFraction01 и selectedSensorMask зависят от urgency, uncertainty и compute budget.
5. AfterOutcome должен использовать реальное observed next state; runtime теперь передаёт post-action observation в core feedback.
6. Все новые state поля должны переживать snapshot/restore.
