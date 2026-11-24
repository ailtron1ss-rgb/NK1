# Active Roadmap — 35.6.14 / B362

## Статус после B361
B361 доказал причинность самого B283-планировщика: 5/5 seed на уровне компонента, restart и lesion/sham PASS. Но Core smoke ранее показывал лишь наличие плана; причинное влияние на окончательный выбор ещё не было доказано.

## B362 — causal predictive selection in the real Core
Внесено качественное усиление одной и той же цепи B283 → candidate score → constitutional arbiter:
1. Добавлен явный режим исследования `predictivePlanningMode`: `on`, `off`, `sham`. Это не новая ветвь организма, а controlled ablation harness для того же Core пути.
2. Планировщик теперь даёт strongest bounded bias только первому воображаемому действию, с затухающей поддержкой следующих шагов.
3. Constitutional arbitration остаётся после planner и сохраняет приоритет veto/safety.
4. OFF полностью убирает planner write в decision field.
5. SHAM выполняет тот же planner, но ослабляет его causal signal до 5%, что даёт matched control.
6. Causal test использует одно и то же сохранённое состояние на tick 7 и три контрфактических Core режима на tick 8; это дешевле и чище, чем три независимых обучения.
7. После ON-прогона план и imagined return проверяются через restart.

## B362 фактические результаты
- Paired Core causal selection: PASS 2/2 независимых seed, полученных до ресурсного ограничения среды.
- В обоих seed: `ON → wait`, `OFF → verify`, `SHAM → verify`.
- В обоих seed SHAM совпал с OFF.
- Restart после ON сохранил план и `plannedReturn01`.
- B361 component predictive lesion/sham: повторно PASS 5/5.
- B359 multi-episode structural plasticity: PASS 5/5.
- B360 executor trajectory ablation: PASS 5/5.

## Что НЕ закрыто
Полная 5-seed Core replication B362 не закрыта: независимые прогоны сверх первых двух упираются в фактический CPU/runtime budget полного OrganismCore. Это OPEN engineering/performance gate, а не разрешение снизить критерий.

## Следующий обязательный шаг
Нельзя переходить к Brick 6/long-horizon planning как к закрытому результату, пока Core-level causal selection не будет реплицирован минимум на 5 независимых seed в пределах документированного runtime budget. После закрытия этого gate следующий шаг — увеличить planning horizon с 3 до 5 шагов, сохранив ON/OFF/SHAM, restart и unseen-context acceptance.

## Ограничения
- Physical Android/Termux gate: OPEN.
- Phenomenal consciousness: UNKNOWN.
- Все выводы B362 относятся к functional causal agency/planning, а не к субъективному сознанию.
