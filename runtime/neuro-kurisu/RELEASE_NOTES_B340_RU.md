# Release Notes B340 — Self-Model Personality Consolidation

B340 связывает уже существующие endogenous-goal learning, self-model и causal personality development в один feedback path.

Реально изменено:
- B299 принимает selfModelAlignment01 и goalLearningQuality01;
- эти сигналы влияют на personality learning rate/evidence/credit;
- OrganismCore передаёт сигналы после B339 self-model update;
- добавлены unit и live-runtime tests;
- master audit и roadmap обновлены.

Доказано: self-model/goal quality меняют personality plasticity; live runtime достигает personality trajectory.
Не доказано: долгий holdout transfer, device proof, consciousness.
