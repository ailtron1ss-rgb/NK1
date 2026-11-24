# P2627–P2640 — Design Decisions

1. Память переведена с пассивного retrieve на closed-loop write/manage/read.
2. Выбор memory strategy сделан online-learning, но bounded: 7 стратегий, без параметрического изменения нейросети.
3. Live self-improvement ограничен bias/redirect-контуром; он не имеет права переписать всю policy одним ошибочным наблюдением.
4. Автобиографическая ценность учитывает identity vector, а не только внешний context.
5. Противоречия не уничтожаются мгновенно: conflicting records получают contradiction penalty и позже могут быть отфильтрованы только при сочетании высокой contradiction и низкой reliability.
6. Память ограничена 96 records для мобильной среды.
7. Новый слой встроен в NeuralExperienceBranch и входит в snapshot/restore.
8. A/B benchmark встроен как обязательный regression artifact, чтобы не считать наличие множества метрик доказательством улучшения.
