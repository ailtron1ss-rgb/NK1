# Design decisions P2545–P2550

1. Memory is a learned operation policy, not a passive FIFO.
2. Memory operations remain bounded and lightweight enough for mobile execution.
3. High-value identity/utility anchors get protection so new experience cannot erase them freely.
4. Multi-horizon latent predictions are trained online at H1/H2/H4.
5. Forecast disagreement becomes an epistemic signal, but only as a bounded action residual.
6. Consolidation runs selectively in low-load windows; it must never block the organism main loop.
7. Stability gate can reduce plasticity when anti-forgetting detects drift.
8. Published improvements are not summed; every transferred mechanism needs a local ablation.
9. No mechanism in this pass is treated as evidence of consciousness.
