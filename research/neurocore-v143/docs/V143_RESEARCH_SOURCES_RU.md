# V143 Research Sources

1. Zhao & Jones — **Fast-weight Product Key Memory**, arXiv:2601.00671 (2026). Core source for factorized product-key routing, chunk-level fast-weight memory, local rewrite and long-context episodic memory.
2. SakanaAI official FwPKM repository — https://github.com/SakanaAI/fast-weight-product-key-memory. Used as current implementation reference; its README exposes the actual training/evaluation structure and long-context NIAH evaluation.
3. Meta — **Byte Latent Transformer: Patches Scale Better Than Tokens**, arXiv:2412.09871 (2024), official repository https://github.com/facebookresearch/blt. Used for byte-level adaptive patching direction; not copied into current trunk.
4. Ouyang et al. — **Test-Time Training with Next-Token Prediction**, arXiv:2606.21803 (2026). Used to validate the lookahead/next-state target direction for fast-weight language adaptation.
5. Lee et al. — **LongMINT**, arXiv:2605.18565 (2026). Used to define revision/interference/retrieval stress requirements for memory qualification.

Implementation policy: ideas are reimplemented only where they fit NeuroCore's explicit state ABI and canonical-owner rule. Research mechanisms remain opt-in until matched multi-seed end-to-end evidence exists.
