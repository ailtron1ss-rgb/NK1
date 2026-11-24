# P2820 + P2835 — Self-Knowledge, Coreset и Transfer-Safety

Дата: 2026-09-20
Релиз: 35.18.0 / P2835

## Идея прохода

После P2805 в проекте уже были stability/plasticity gates, slow weight references и replay compatibility. Следующий bottleneck: replay и consolidation не должны автоматически считать любой прошлый опыт полезным для текущей задачи.

Поэтому добавлены два связанных слоя:

`P2820 SelfKnowledgeCoresetBridge`
→ медленный context-conditioned teacher, self-distillation, bounded coreset и teacher-aware replay.

`P2835 TransferSafetySynergyController`
→ task-signature compatibility, transfer opportunity, negative-transfer risk, replay gate и bounded orthogonal/plasticity safety gate.

Новый общий контур:

`experience → context signature → teacher → coreset → transfer compatibility → replay → stability/plasticity gate → neural update → teacher refresh`

## P2820

Реализовано:

1. slow teacher per context;
2. teacher confidence/calibration;
3. student/teacher agreement;
4. bounded self-distillation of action readout;
5. 96-slot adaptive coreset;
6. coreset compaction/deduplication;
7. diversity-aware replay ranking;
8. teacher-aware replay compatibility;
9. persistence/restart;
10. explicit enable/disable ablation.

## P2835

Реализовано:

1. 12-D context/task signature;
2. online context prototypes;
3. compatibility scoring;
4. positive transfer score;
5. negative-transfer risk;
6. replay utility gate;
7. bounded update safety / orthogonality proxy;
8. resource-aware transfer pressure;
9. action bias toward explore/verify when transfer is uncertain;
10. direct coupling to synaptic learning;
11. context-aware replay provenance;
12. persistence/restart.

## Research basis

### Transfer-Selective Replay — 2026

Идея TSR: replay должен подбираться с учётом того, способен ли прошлый опыт улучшить именно текущую задачу; replay совместимых задач может давать forward transfer, а несовместимый replay — мешать.

Источник: https://arxiv.org/abs/2607.15587

### Beyond Retention / Orthogonal Subspace Wake-up — 2026

Работа показывает, что replay может вести к negative transfer и что сохранение критических подпространств при новых обновлениях может быть полезнее, чем безусловный replay.

Источник: https://arxiv.org/abs/2601.18255

### Coresets are more than replay — Neural Computing & Applications 2026

Coreset selection можно использовать не только для уменьшения replay buffer, но и для улучшения stability/plasticity при меньшем compute; авторы также подчёркивают dataset/method-dependent effects.

Источник: https://link.springer.com/article/10.1007/s00521-026-12273-y

### Self-Distillation Enables Continual Learning — 2026

Self-distillation предлагается как способ одновременно накапливать новые навыки и снижать regression старых.

Источник: https://doi.org/10.48550/arXiv.2601.19897

### Continual Policy Distillation from Distributed RL Teachers — 2026

Teacher→student distillation используется как стабильный канал переноса знаний между последовательными задачами.

Источник: https://arxiv.org/abs/2601.22475

### FOREVER — 2026

Replay schedule привязывается к model-centric time вместо raw step count. Это уже реализовано у нас через P2774 model-time replay.

Источник: https://aclanthology.org/2026.acl-long.1144/

### FIRE — ICLR 2026

FIRE предлагает принципиальный stability/plasticity-aware механизм reinitialization. P2805 пока использует более дешёвый bounded proxy; FIRE остаётся кандидатом для следующей selective-reset итерации.

Источник: https://proceedings.iclr.cc/paper_files/paper/2026/hash/8a47999fdfecfd0ab2730487d87b0b47-Abstract-Conference.html

## Экспериментальные доказательства

`P2820_SYNERGY_MATRIX=PASS`

28 runs, 2 regimes, 7 variants, 2 seeds.

Режимы:
- A→B→A;
- A→B→C→B→A.

Полный stack реально активировал teacher/co-restore:
- teacher updates = 64;
- coreset writes = 64.

Важно: в коротком горизонте full-stack не дал автоматического reward gain относительно некоторых частичных вариантов. Это ожидаемый trade-off и не считается fail.

`P2835_TRANSFER_SAFETY_SYNERGY=PASS`

8 runs, 2 regimes, 2 seeds в сокращённом matched battery:
- teacher updates = 90/run;
- coreset writes = 90/run;
- trajectory separation относительно control — PASS;
- restart — PASS.

## Ограничения

- Synthetic benchmark;
- нет доказательства сознания;
- нет доказательства универсального positive transfer;
- реальные Android/Termux measurements остаются отдельным этапом;
- full 28-run/8-run batteries не должны запускаться в одном long-lived Node process: sequence-level resource pressure создаёт ложные timeout.
