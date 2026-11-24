# Neuro-Kurisu 34.25.0

## BIG PASS 54 — World Model Grounding

Главный результат: perception, evidence и world-model получили единый grounded bridge.

### Добавлено

- GroundedWorldState
- provenance-aware world objects
- epistemic distinction observed vs hypothesis
- semantic signature в P27 world representation
- grounded world handoff в WorldModel2/P27
- `/api/organism/world-grounding`
- regression suite BIG PASS 54

### Исправлено

- предотвращена автоматическая promotion model-output → observed truth;
- убран лишний grounding work на циклах без реального perceptual/world signal;
- устранены лишние nested lookups в GroundedWorldState hot path;
- синхронизированы release/source-of-truth документы.

### Верификация

Основные architecture/security/persistence/perception integration gates: PASS.
250 и 500-warm operational: PASS.
Полный 1000-cycle не используется как release-gate в текущем runtime environment; контрольный 34.24.0 также не завершился в том же окне.
