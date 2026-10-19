# P2844 Benchmark Matrix

| Benchmark | Baseline | Ablation | Evidence |
|---|---|---|---|
| Multi-timescale plasticity | B296 learning on | learningRate=0 | plasticity delta |
| A→B→C→A anti-forgetting | trained memory | ablation comparison | recall score |
| Lesion/recovery | intact | 50% synapse lesion | behavioral distance + repair |
| Sequence memory | predecessor-linked episodes | broken links | order score |
| False-memory | low verification | consolidation gate | semantic depth/rejection |
| Reconsolidation | retrieval updates trace | no retrieval | reconsolidation count |
| Restart equivalence | snapshot | restore | state/recall equivalence |
| Mobile budget | bounded state | unconstrained state prohibited | runtime/resource tests |
