# V126

- version -> 1.26.0 / `v126-consolidation-runtime`
- automatic opt-in fast→slow consolidation added to current trainer
- invalid inert consolidation configuration rejected
- sparse-state write path refactored to functional sparse delta
- current qualification benchmark moved to canonical trunk config
- new runtime and gradient tests added
- legacy benchmark API no longer treated as current surface
- anti-decoration audit expanded to consolidation reachability and state-write safety
- оба current trainer path сведены к одному post-optimizer controller lifecycle/consolidation path
- sparse candidate gradient liveness проверяется на нескольких seed без ложного требования полного single-batch coverage для sparse routing
