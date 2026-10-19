# V86 → V87 NEXT FRONTIER

## PASS 87 — Model-aware Replay Utility

Главная цель: перейти от `priority at write-time` к ограниченному измерению фактической полезности replay sample для текущего состояния модели.

1. Добавить bounded candidate probe на маленьком subset buffer.
2. Для кандидатов вычислять detached per-sample replay error на текущей модели.
3. Отдельно оценивать current-vs-replay interference proxy без полного второго backward.
4. Обновлять slot priority EMA по фактическому replay utility.
5. Сохранить V86 reuse/coverage safety-floor.
6. Сравнить:
   - V84 legacy;
   - V86 coverage-aware;
   - V87 model-aware utility.
7. Stress: A→B→C→A→B→C, 3 seeds.
8. Lesion → replay recovery до и после utility-guided selection.
9. Compute budget отдельно от optimizer-step budget.
10. Только при non-regression + measurable independent gain продвигать V87 в current trunk.

## Architecture gate

Не менять V82 recurrent backbone до тех пор, пока replay information quality и model-aware replay utility не квалифицированы. Затем провести compute-matched A/B против GRU V80 и compact selective-delta V82, а позже против внешних linear-recurrent candidates.
