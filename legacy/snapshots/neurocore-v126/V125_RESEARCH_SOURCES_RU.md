# V125 — Research Sources

- Hierarchical Memory Mamba (Aug 2026): hierarchical working-to-persistent memory addresses fixed recurrent-state capacity bottlenecks.
- Sparse Delta Memory (2026): sparse product-key addressing + gated delta writes, providing a direct reference for large sparse state with bounded updates.
- Mamba-3 official source (2026): heavy-tail activation and richer recurrent state dynamics; NeuroCore uses only the activation candidate, not a claimed full Mamba-3 implementation.
- Gated DeltaNet-2 (2026): independent erase/write and channel-wise retention motivate the current gated update decomposition.

The V125 fingerprint mechanism is an original NeuroCore composition: a compact deterministic slice of the already computed key is retained per slot to disambiguate partially colliding product-key routes, without adding another learned memory owner.
