# Release Notes — B266

## B266 Hidden Task Generalization
- Добавлен независимый генератор скрытых семейств задач.
- Добавлены разные горизонты train/holdout.
- Добавлены delayed rewards, drift и adversarial task families.
- Добавлены hidden-family, long-horizon, delayed-reward и robustness metrics.
- Добавлен replay stress.
- Добавлены snapshot/migration проверки.
- B266 встроен в OrganismCore.
- Добавлены явные npm aliases для B265 regression suite.

## Evidence
B266 Core показал:
- hidden-family gain 0.02778;
- long-horizon gain 0.05597;
- delayed-reward gain 0.05329 / 0.10152 после stress;
- robustness 0.77187;
- catastrophic shift 0.00726.

## Ограничения
Не заявляется open-world general intelligence, physical causal agency или consciousness. Полный исторический audit и full-tree syntax sweep не объявлены PASS из-за ограничений времени выполнения среды.
