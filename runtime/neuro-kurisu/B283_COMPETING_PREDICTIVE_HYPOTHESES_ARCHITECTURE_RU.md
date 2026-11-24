# B283 — Competing Predictive Hypotheses Workspace

## Цель
B283 превращает одиночный predictive global workspace B282 в конкурирующее пространство нескольких глобальных гипотез о будущем состоянии организма.

## Что является новой нейронной сущностью
Каждая гипотеза имеет собственный recurrent predictor, latent state и action readout. Гипотезы получают общий neural context от B282, self, world, goal, autobiographical memory и personality.

Это не четыре символических сценария: у каждой гипотезы есть обучаемые параметры, локальная plasticity и собственный posterior/evidence/confidence.

## Динамика
1. Global latent B282 становится входом.
2. Несколько гипотез одновременно строят prediction.
3. Evidence вычисляется по соответствию global/self/world/goal/memory.
4. Soft posterior распределяет вероятность между гипотезами.
5. Победитель получает action readout и влияет на arbitration.
6. Delayed outcome обучает активную гипотезу.
7. Независимое evidence может позволить commit.
8. Низкое evidence приводит к reject; предыдущий commit может быть восстановлен.
9. Snapshot/migration сохраняют весь competing-workspace state.

## Связь с личностью Курису
Committed hypothesis может порождать causal personality evidence. Trait выбирается по фактически выбранному действию, а strength/confidence/evidence зависят от neural self-alignment и quality of the hypothesis.

## Что B283 НЕ доказывает
B283 не доказывает phenomenal consciousness, не является биофизическим cortex и не делает сознание эквивалентным global workspace. Это проверяемый predictive/recurrent engineering substrate.
