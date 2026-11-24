# Audit Recheck — Neuro-Kurisu 35.16.0 / P2774

Дата: 20.09.2026

## 1. Реализовано
- `P2774ModelTimeReplayConsolidator` добавлен в production source.
- `NeuralExperienceBranch` переведён на state version 25.
- P2774 snapshot/restore интегрирован.
- Model-time scheduler управляет replay due/limit/order.
- Forgetting-risk участвует в replay interval и learning-scale modulation.
- Episodic trace store bounded до 64 записей.
- Старые traces compact-ятся с context/action aggregation.
- Повторяемые контексты получают slow semantic consolidation.
- Semantic state имеет bounded bridge обратно в `slowMemory`.
- Все новые поля проходят persistence.

## 2. Research-driven decisions
P2774 использует идеи model-centric replay time (FOREVER), recurrence-gated consolidation (RecMem), fast episodic/slow semantic interaction (Nature Communications 2026) и resource-constrained temporal compression (CAS-Bridge-Diffusion). Реализация сознательно упрощена до on-device статистического механизма и не копирует тяжёлые LLM/PPO pipeline.

## 3. Runtime evidence
- P2774: PASS — 420 outcomes, modelTime 277.709, stress forgetting risk 0.2750, quiet interval 4.739, stress interval 3.790, 356 compactions, 402 consolidations, 120 replay samples, restart 420.
- P2760: PASS — 960/480/192 rich writes; tight slow writes 145; bridges 0.7004 / 0.7250.
- P2750 core: PASS — 510 outcomes, 4 contexts, 15 switches, synthetic replay 179, restart 510.
- P2750 interference: PASS — 720 outcomes, 4 contexts, 180 A visits.
- P2750 fallback: PASS.
- P2750 mobile compaction: PASS — 19 compactions, 4446 compacted, buffer 396.
- P2742: PASS — 445 outcomes, 6 contexts, 90 interventions, 75 high-information events, restart 445.
- P2734: PASS — 320 outcomes, 6 contexts, 32 switches, replay feedback 320, restart 320.
- P2726: PASS — 240 outcomes, 3 contexts, restart 240.
- P2720: PASS — 72 outcomes, restart 72.
- P2716 deep: PASS.
- P2716 continual: PASS — expForgetA 0.0164 vs control 0.0883; expForgetB 0.0112 vs control 0.0020. Это один matched synthetic run, не универсальная гарантия.
- P2716 promotion: PASS.
- P2708 deep: PASS.
- P2708 continual: PASS — expForgettingA 0.0282 vs control 0.0408; generalization 1.0 / 1.0.
- P2708 long-horizon: PASS.
- P2724 mobile endurance: PASS — 1500 cycles, 750 outcomes, max heap growth 28.6 MB, restartOk=1.
- organism smoke: PASS.
- server smoke: PASS.

## 4. Static / source audit
- TYPECHECK PASS.
- audit:full PASS — files 3539, canonical 513, errors 0, warnings 0.
- architecture PASS — sourceFiles 1598, canonicalFiles 513, missing 0, cycles 0, legacyLeakage 0.
- integrity PASS — release 35.16.0, core 100.7.0-model-time-replay-p2774, schema 206.
- forensics PASS — activeFiles 3524, duplicateContent 0, duplicateNames 0, empty 0.
- hygiene PASS — errors 0, warnings 0.
- syntax PASS — JS 1107, SH 6, JSON 240.
- contract PASS.
- release source PASS.
- archive manifest PASS — 3785 files, missing 0, hash mismatches 0, extra 0.

## 5. Known limitations
- Полная единая runtime-батарея по 18 шагам может упираться в cumulative Node resource pressure; отдельные чистые процессы используются как канонический runtime evidence. Такой timeout не засчитывается как PASS.
- Host organism smoke ранее достигал ~650+ MB RSS; physical Android/Termux device gate ещё нужен для окончательной mobile qualification.
- P2774 model-time — инженерная proxy шкала, а не физическая/биологическая единица времени.
- Semantic consolidation bounded и намеренно слабый; он не доказывает человеческий hippocampo-neocortical механизм.
- Систему нельзя называть доказанным сознанием; текущие cognitive/consciousness claims остаются экспериментальными гипотезами, требующими независимых ablation tests.

## 6. Итог
P2774 считается validated engineering increment после отдельных runtime regressions и полного static/source audit. Полный ZIP будет создан только из этого проверенного дерева после финальной manifest regeneration и `unzip -t`.
