# Release Notes — B261

## B261 Unified World Model 2

Большой апдейт мозговой ветви.

### Добавлено

- `src/organism/cognition/B261UnifiedWorldModel.ts`
- action-conditioned next-latent dynamics;
- reward prediction;
- online learning;
- episodic replay;
- holdout;
- action comparison;
- lesion testing;
- persistence/migration.

### Интегрировано

`P27 -> B259 -> B261 -> feedback -> replay -> persistence`

### Исправлено

Обнаружен и исправлен migration gap, из-за которого episodic buffer B261 терялся после restart.

### Проверено

B259, B260, B261 standalone/core + architecture/integrity/hygiene/contract/forensics/release-source/archive.
