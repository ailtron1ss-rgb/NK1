# R21 Change Matrix

| Компонент | До R21 | После R21 | Доказательство |
|---|---|---|---|
| Operational journal | `NoopOperationalJournal` compatibility alias | `BoundedOperationalJournal` canonical | P2901 + zero legacy refs |
| Capability registry | binary `available` | status + evidence + owner | P2901 |
| Simulation capability | available=true without explicit lane | `simulation-only` | P2901 |
| Shadow bridge | implicit simulation commit | explicit predictive-sandbox lane + promotion guard | P2901 |
| Anti-decoration audit | marker-focused | marker + source/evidence truth surfaces | P2901 |
| Mobile semantics | host-sensitive risks previously found | unchanged sequence under current R21 run | P2868 |
