# B297+ — строгая цепочка исполнения мозговой ветви

## Центральная ветвь

`Input/Interoception -> Recurrent Neural State -> Self/World Prediction -> Drives/Agency -> Candidate Actions -> B297 Executive Fusion -> Canonical Commit -> Execution -> Consequence -> Independent Evaluation -> Causal Credit -> Plasticity -> Memory/Replay -> Self/Personality Change -> Future Action`

## Dependency rule

Нельзя переходить к следующему уровню только потому, что код существует. Следующий уровень открывается после evidence gate предыдущего.

### Gate 1 — Live

Организм делает автономный тик без внешнего сообщения.

### Gate 2 — Learning

После тика внутреннее состояние изменяется в зависимости от опыта.

### Gate 3 — Causal

Удаление/lesion конкретной подсистемы ломает именно ожидаемую способность.

### Gate 4 — Transfer

Эффект переносится на unseen context.

### Gate 5 — Longitudinal

Эффект сохраняется после restart/replay и улучшается на длинном горизонте.

### Gate 6 — Real world

Есть реальный external consequence и postcondition.

## Work policy

Каждый BIG PASS должен включать:

- 1 крупный behavioral objective;
- 3–10 внутренних шагов;
- baseline;
- ablation/lesion;
- persistence/restart;
- holdout context;
- evidence file;
- update of progress scale;
- regression check.

Минимум 40% инженерного времени очередного большого прохода должно идти на закрытие evidence debt, пока strict VERIFIED существенно не вырастет.

## No-decoration rule

Запрещено повышать maturity score только за:

- новый файл;
- новый класс;
- новый state field;
- новый weighted formula;
- наличие snapshot;
- integration PASS без behavioural postcondition.
