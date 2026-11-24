# B282 Release Notes

B282 добавляет Predictive Global Workspace и связывает B280 multi-area neural circuit с B281 predictive inter-area messaging.

Главные изменения:
- global latent workspace
- coalition competition
- ignition/dwell tracking
- next-global-state prediction
- delayed prediction error
- action influence
- area-level causal lesion
- persistence/migration
- OrganismCore integration

Исправлен методологический дефект initial lesion metric: она не зависела от реального encoded activity. После исправления lesion пересчитывается на stored lastAreaSpikes и вызывает измеримый causal drop.
