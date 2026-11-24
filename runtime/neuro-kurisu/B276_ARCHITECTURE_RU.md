# B276 — Иерархические Latent Action Programs

## Цель

B276 поднимает B275 на уровень составных программ поведения. B275 учил нейронную policy выбирать фиксированные ActionKind и комбинировать уже известные skills. B276 вводит отдельные latent-program объекты: каждый объект состоит из нескольких нейронно заземлённых узлов, связанных в направленную цепочку, имеет собственное latent-представление, gating, value, verification state и переносимость.

## Единый цикл

`self/world/goal/neural state`
→ `latent program proposal`
→ `hierarchical node composition`
→ `imagined gain`
→ `bounded real trial`
→ `independent evidence`
→ `verification / rejection`
→ `transfer to a new goal context`
→ `action bias`
→ `real outcome`
→ `learning / personality evidence`
→ `persistent program memory`.

## Что принципиально нового

1. Программа имеет собственную латентную траекторию, а не только список действий.
2. Узлы программы связаны `children`, поэтому глубина композиции измеряется отдельно.
3. Программа зависит одновременно от goal, self-latent, world-latent, spiking assembly и personality bias.
4. Проверка использует независимый gain, prediction error, robustness, personality alignment и self-alignment.
5. Verified program можно переносить в новый goal-context.
6. Состояние полностью сохраняется и восстанавливается через OrganismCore/StateMigrations.

## Ограничение

Primitive ActionKind остаются дискретными. Поэтому B276 ещё не создаёт новый физический моторный оператор из ничего. Новизна находится на уровне latent-программ и их иерархической композиции. Следующий этап должен научиться синтезировать более открытые latent operators и обучаемые world-model operators, чтобы программа могла выходить за текущий словарь примитивов.
