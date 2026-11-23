# NK1 WorkPass359 — обратная связь субстрата и ресурсного планировщика

## Что изменено
- Предыдущий snapshot субстрата теперь влияет на следующий allocation через чистую функцию resolveUnifiedCognitiveResourceSignals: неопределённость (70% current Core error + 20% prior world uncertainty + 10% prior prediction error), novelty (current autonomy vs new-entity rate and prior prediction error), unresolved prediction priority (max current debt priority, half prior substrate priority).
- Нормализация ограничена [0,1], повреждённые входы ведут к консервативным значениям, а не к росту уверенности.
- Безопасное чтение prediction debt сведено к общей safePredictionDebtPriority и используется во всех трёх точках runtime, включая sampleEmbodiment.
- Добавлены модульные и runtime wiring регрессии. Действие по-прежнему выбирает OrganismCore; обратная связь регулирует ресурсы/объём необязательной работы.

## Проверка
- WorkPass358 точный WorkPass331 workflow: success.
- WorkPass359 требует нового exact-head CI; локальный запуск не заявляется.
