# V85 → V86 NEXT FRONTIER

## Главная цель

Сделать replay не просто исполненным, а информационно полезным под реальным task conflict.

## PASS 86 — Replay Information Quality

1. Добавить replay diversity metric по input-domain и target-space.
2. Убрать возможность top-priority samples полностью вытеснять coverage.
3. Ввести bounded stratified replay: novelty × conflict × age × coverage.
4. Сравнить learned target vs externally supplied target; не допускать тихого self-distillation там, где есть ground-truth target.
5. Сделать long-horizon stress с повторяющимся A→B→C→A→B→C.
6. 3+ seeds на коротком stress и минимум 2 seeds на длинном.
7. Measure recovery after lesion и replay-only reconstruction.
8. Separate compute budget from optimizer-step budget.
9. Только после этого — compute-matched recurrent tournament: V82 custom delta, GRU V80, Mamba-3/linear-recurrent candidates.
10. Mobile profiling только после desktop quality gate.

## Архитектурное правило

Не добавлять новый recurrent backbone, пока не измерена ценность самого replay information path.
