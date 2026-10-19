# NeuroCore V143 — FwPKM × Real Language Qualification

## Что сделано
- Внедрён research-only `FwPKMLanguageBridge` поверх существующего byte-language path.
- FwPKM исправлен по трём критичным пунктам:
  1. IDW routing теперь использует нормализованный `2-2*cosine` вместо `torch.cdist`.
  2. fast-state rewrite нормализует локальный update по фактической routing mass, а не по числу коллизий.
  3. добавлен differentiable `local_rewrite_loss`/`sequence_trainable`, чтобы slow product-key codebooks действительно получали градиент; fast state при этом обновляется detached локально.
- Research language residual readout zero-initialized, поэтому добавление FwPKM не меняет базовую модель до фактического обучения bridge.
- FwPKM остаётся research-only и не становится вторым canonical memory owner.

## Evidence
- Real-text bridge benchmark: 8 окон проектного текста, начальный residual readout нейтрален; delta loss = 0.0.
- Memory capacity benchmark: 3 seeds, 32 keys, 256 distractors, shared memory state.
  - mean recall = 0.96282
  - min recall по seed >= 0.7429
  - revision new-value cosine = 0.95498
  - revision old-value cosine = 0.26719
- IDW routing microbenchmark (512 queries): ~1.185x faster, чем старый `cdist` variant, в этом CPU control.
- Codebook gradient test после существующего memory state: оба product-key codebooks получают ненулевой gradient.

## Decision
- FwPKM memory mechanism: **CANDIDATE** — сильное isolated evidence.
- FwPKM language bridge: **PENDING / NO PROMOTION** — language E2E не улучшен; initial neutral bridge подтверждён.
- Нет изменения canonical memory owner.

## Главное ограничение
Real-text multi-seed language training остаётся ограниченным CPU-временем и не считается квалифицированным доказательством. Следующий pass должен делать efficient chunked execution и затем повторить 1K/4K/16K language benchmarks.
