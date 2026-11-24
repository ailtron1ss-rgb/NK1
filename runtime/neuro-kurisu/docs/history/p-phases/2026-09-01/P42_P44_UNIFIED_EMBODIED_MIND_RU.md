# P42–P44 — Unified Embodied Mind

## Практический эффект
Этот релиз объединяет три больших функциональных слоя: единое состояние опыта, внутреннюю grounded scene representation и action-conditioned predictive world. Они реально подключены к decision/persistence path.

## Почему это лучше отдельного scene module
Сцена не должна быть независимой «картинкой смысла». Один и тот же объект/событие может одновременно присутствовать как perception evidence, memory cue, self-location relation и predicted future state.

## Что реализовано
- P42 shared embodied experience vector (24 dimensions), history, salience, confidence, surprise, self/world coupling.
- P43 grounded representational imagery with active scene contents and imagined actions.
- P44 lightweight learned action-conditioned transition model and multi-step rollouts.

## Что не реализовано
- human-level vision understanding;
- human-level audio semantics;
- phenomenal visual imagery/qualia;
- full external causal simulator.

## Design law
Raw modalities are evidence. Shared experience is representation. Cognition consumes representation; it does not receive an oracle-generated «meaning» that is trusted by default.
