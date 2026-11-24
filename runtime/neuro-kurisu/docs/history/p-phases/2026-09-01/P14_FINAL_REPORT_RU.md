# Neuro-Kurisu Evolution 6.0.0 — P14 final report

## Результат
P14 добавил реальное event-driven perception поверх Android/Termux body layer. Сенсоры теперь не только отображаются: изменения проходят в cognitive field, salience routing и следующий cognitive cycle.

## Главные изменения
- `PerceptionEngine` с temporal baseline и change detection;
- `PerceptionRouter` направляет события в attention/homeostasis/memory/workspace;
- external event ingress;
- on-demand camera capture с удалением временного файла после SHA-256;
- кэш Termux capabilities 60 секунд;
- persistent perception/routing state;
- API для perception/event/camera;
- UI panel и camera control;
- migration schema `16 -> 17`;
- release tooling и tests обновлены под P14.

## Почему это важно
Embodied intelligence связывает perception, world modelling и action в единый loop; современные обзоры подчёркивают, что robustness в физическом мире требует учитывать тело, среду и feedback, а не только модель. В нашей архитектуре это выражено как `body -> perception -> cognition -> action -> outcome -> learning`.

## Ограничения
P14 не создаёт biological brain simulation, не утверждает phenomenal consciousness и не реализует полноценную neural vision model. Camera capture пока создаёт проверяемый sensory artifact/hash; semantic visual interpretation остаётся следующим этапом.
