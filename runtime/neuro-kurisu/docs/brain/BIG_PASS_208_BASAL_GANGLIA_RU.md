# BIG PASS 208 — Basal Ganglia / Action Selection

## Цель

Продолжить «Карту искусственного мозга» не количеством новых P-модулей, а закрытием одной биологически мотивированной ветки: **cortex → basal ganglia → thalamus/action selection → outcome → plasticity**.

## Что добавлено

`BasalGangliaSelectionCircuit` — вычислительная аналогия, включающая:

- direct-pathway-like facilitation;
- indirect-pathway-like suppression;
- hyperdirect-like conflict brake;
- dopamine-gated action plasticity;
- action-specific eligibility traces;
- reversible lesion/ablation mode;
- snapshot/restore;
- интеграцию в `CognitiveKernelCoordinator`;
- persistence mapping через `StateMigrations`;
- brain-atlas ownership/evidence update.

Это **не** буквальная симуляция D1/D2 MSNs, GPi/GPe/STN/SNr или человеческой анатомии.

## Почему выбрана именно эта ветка

Basal ganglia входят в cortico-basal-ganglia-thalamo-cortical loops и связаны с reinforcement learning, action selection и habit/goal-directed control. Современная литература, однако, показывает, что упрощённая схема «direct = go / indirect = no-go» неполна: две популяции могут активироваться совместно, а их функции зависят от состояния пластичности и контекста. Поэтому реализация оставлена как тестируемая computational analogue. [1–5]

## Реальные проверки

### Локальный circuit proof

- здоровое состояние: `explore` получает максимальный selection gate;
- многократный положительный outcome повышает learned action value `explore`;
- при низком dopamine и высоком conflict повышается hyperdirect brake;
- lesion mode сводит action gate к почти нейтральному значению;
- snapshot/restore сохраняет cycle count и learned action values.

### Core integration proof

`CognitiveKernelCoordinator` реально потребляет basal-ganglia output. `OrganismCore` проходит через этот coordinator, а состояние после checkpoint/restart восстанавливает `basalGangliaSelection`.

Последний regression run:

```text
BIG_PASS_204 = PASS
BIG_PASS_205 = PASS
BIG_PASS_206 = PASS
BIG_PASS_207 = PASS
BIG_PASS_208 = PASS
TYPECHECK = PASS
ARCHITECTURE = PASS
INTEGRITY = PASS
HYGIENE = PASS
SYNTAX = PASS
CONTRACT = PASS
FORENSICS = PASS
RELEASE_SOURCE = PASS
BRAIN_AUDIT = PASS
```

## Quantitative witness

Из последнего B-M3 run:

- healthy selected action: `explore`;
- healthy selection margin ≈ `0.0873`;
- repeated positive learning produced `explore` action value ≈ `+0.0221`;
- conflict condition increased hyperdirect brake to ≈ `0.4288`;
- lesion left explore gate ≈ `0.5012`;
- Core consumed 3 basal-ganglia cycles;
- Core restore: `PASS`.

Эти числа доказывают работоспособность созданного computational circuit и persistence path, но не биологическую эквивалентность.

## Что ещё не закрыто

1. Explicit striatum / GPi / GPe / STN / SNr state graph.
2. Separate dorsal vs ventral striatal territories.
3. Distinct motor / associative / limbic loops.
4. Full cortico-basal-ganglia-thalamo-cortical closed-loop execution.
5. More faithful dopamine temporal/pulse model.
6. Interaction with a future cerebellar predictive-control circuit.
7. Real embodied motor output, not only symbolic action selection.

## Научные ограничения

Dopamine нельзя свести только к единственному scalar reward-prediction-error signal: современные работы рассматривают более широкую роль dopamine в action selection, uncertainty и различающихся типах prediction error. Direct/indirect pathways также не являются полностью независимыми «Go/No-Go» каналами. [2–5]

## Следующий крупный участок

**B-M4 Cerebellar Predictive Control**: fast forward model + motor prediction error + timing + calibration, соединённый с новым B-M3 через thalamic/cerebellar influence, но с отдельным ablation proof.

### Источники

[1] Averbeck, B. & O’Doherty, J. *Reinforcement-learning in fronto-striatal circuits*. Neuropsychopharmacology (2022). https://www.nature.com/articles/s41386-021-01108-0

[2] Cox, J. & Witten, I. *Striatal circuits for reward learning and decision-making*. Nature Reviews Neuroscience (2019). https://www.nature.com/articles/s41583-019-0189-2

[3] Calabresi et al. *Direct and indirect pathways of basal ganglia: a critical reappraisal*. Nature Neuroscience (2014). https://www.nature.com/articles/nn.3743

[4] Lee, J. & Sabatini, B. *From avoidance to new action: the multifaceted role of the striatal indirect pathway*. Nature Reviews Neuroscience (2025). https://www.nature.com/articles/s41583-025-00925-2

[5] Gershman, S. & Uchida, N. *Believing in dopamine*. Nature Reviews Neuroscience (2019). https://www.nature.com/articles/s41583-019-0220-7
