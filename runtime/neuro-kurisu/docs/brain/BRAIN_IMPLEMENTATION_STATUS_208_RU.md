# Карта искусственного мозга — статус B-M3

## B-M3 Basal Ganglia Selection Circuit

Введён `BasalGangliaSelectionCircuit` как вычислительная аналогия cortico-basal-ganglia-thalamo-cortical action-selection контура.

### Реализовано
- direct-pathway-like facilitation
- indirect-pathway-like suppression
- hyperdirect conflict brake
- dopamine-gated action plasticity
- action-specific eligibility traces
- reversible lesion mode
- snapshot/restore
- интеграция в `CognitiveKernelCoordinator`
- persistence через `StateMigrations`
- atlas ownership/evidence update

### Проверено
- reward-driven increase of selected action value
- high-conflict/high-uncertainty increase of hyperdirect brake
- lesion removes strong circuit gating influence
- snapshot/restore preserves learned action values and cycle count
- coordinator actually consumes basal-ganglia gate output

### Научный статус
Это **computational analogue**, а не анатомическая/физиологическая симуляция человека. Современная литература подтверждает роль fronto-striatal circuits в reinforcement learning and action selection, но классическая direct/indirect dichotomy считается полезным упрощением, а не полной картиной basal ganglia.

### Следующий gap
Остаются explicit nucleus-level dynamics (striatum/GPi/GPe/STN/SNr), dorsal/ventral striatal territories и полный closed-loop motor execution.
