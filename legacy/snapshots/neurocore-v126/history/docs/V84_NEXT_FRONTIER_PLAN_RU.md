# V84 → V85 NEXT FRONTIER PLAN

## Главный принцип

Не добавлять новую capability, пока replay controller не проверен на external continual-learning stream.

## PASS 85

1. Реальный external sequential dataset, начиная с `sklearn_digits` и затем task-shift stream.
2. Same-checkpoint four-way A/B:
   - current-only;
   - fixed replay;
   - V84 adaptive replay;
   - V84 adaptive + sparse diagnostic surgery.
3. Learnability gate до forgetting metrics.
4. Метрики:
   - old-task loss;
   - new-task loss;
   - positive forgetting;
   - adaptation;
   - BWT/FWT;
   - replay events;
   - replay diversity/starvation;
   - exact diagnostic frequency;
   - wall-time;
   - RAM/parameter/state footprint.
5. 3+ seeds на коротком протоколе.
6. Только после стабильного короткого protocol — длинный 1k/5k режим.
7. При достаточной qualification — CPU/GPU compute-matched backbone tournament.
8. Mobile gate на Poco F6 после desktop qualification.

## Research candidates after V85

- Gated DeltaNet family;
- Mamba-3 family;
- custom compact recurrent state;
- possible hybrid only if a controlled ablation shows complementary value.
