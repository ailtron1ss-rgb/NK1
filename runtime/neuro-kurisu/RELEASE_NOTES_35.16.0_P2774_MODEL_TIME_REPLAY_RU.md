# Neuro-Kurisu 35.16.0 — P2774

P2774 добавляет Model-Time Replay & Episodic→Semantic Consolidation.

## Production code
- `P2774ModelTimeReplayConsolidator.ts`
- интеграция в `NeuralExperienceBranch`
- state version `25`
- release schema `206`

## Основные механизмы
1. model-time accumulator;
2. forgetting-aware replay interval;
3. replay debt;
4. compact episodic trace store;
5. recurrence-aware context/action memory;
6. semantic consolidation;
7. resource-aware replay budget;
8. bounded semantic bridge в slow-memory;
9. persistence.

## P2774 test
`P2774_MODEL_TIME_REPLAY=PASS modelTime=277.709 stressRisk=0.2750 quietInterval=4.739 stressInterval=3.790 compact=356 consolidate=402 replaySamples=120 restart=420`

## Важное
Переход на model-time не считается доказательством общего прироста обучения без factorial benchmark. Архитектура специально ограничена по силе, чтобы не нарушить старые causal/context regressions.
