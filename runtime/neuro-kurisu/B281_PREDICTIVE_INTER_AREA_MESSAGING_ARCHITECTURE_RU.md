# B281 — Predictive Inter-Area Messaging

## Цель
Перевести B280 из многoобластной recurrent-сети в сеть, где области не просто обмениваются спайками, а **предсказывают следующее состояние друг друга**. Передаваемое сообщение имеет собственную encoder/predictor/context структуру, а ошибка приходит с задержкой на следующий такт.

## Архитектура
- 4 области: sensorium, memory, association, selfAction;
- 12 направленных межобластных рёбер;
- 8-мерные сообщения;
- отдельные encoder, predictor и context weights на каждом ребре;
- message trace и synaptic availability;
- delayed one-step target: prediction(t) сравнивается с observation(t+1);
- delayed credit и third-factor plasticity;
- cross-area lesion;
- action bias от предсказательной согласованности;
- snapshot/migration.

## Почему это нейроннее B280
B280 доказывал, что cross-area связь существует. B281 добавляет **predictive coding across areas**: каждая область должна уметь предсказывать следующую конфигурацию другой области. Это важнее простого message bus, потому что обучение привязано к будущей ошибке другой области.

## Что специально проверяется
1. Delayed target, а не target того же такта.
2. Hidden transfer на новой temporal mapping.
3. Lesion межобластного ребра.
4. Persistence/migration.
5. Core lifecycle.
6. Independent baseline comparison.

## Ограничения
B281 не является биофизической кортикальной моделью. Message dimensions маленькие, четыре области — инженерная редукция, а synaptic kinetics остаются вычислительной аппроксимацией.
