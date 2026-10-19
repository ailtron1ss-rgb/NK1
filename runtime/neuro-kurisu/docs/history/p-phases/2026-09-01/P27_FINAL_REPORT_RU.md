# P27 — Learned Perception & World Foundation

## Цель

P27 переводит P24/P26 из набора hand-written feature/bias механизмов к компактному обучаемому представлению ситуации и обучаемой модели последствий действий.

Ключевая проверка: новые механизмы должны менять persisted state, участвовать в ranking, обобщаться за пределами exact-context lookup и оставаться пригодными для среднего телефона.

## Что реально реализовано

### 1. Compact multimodal encoding

`P27NeuralWorldFoundation` принимает:
- text;
- компактные vision features;
- локальные audio samples;
- organism sensor state;
- WorldContext.

Vision/audio здесь являются **локальными признаковыми адаптерами**, а не полноценными нейросетевыми vision/audio encoders. Если Android не передал признаки, система не утверждает, что понимает изображение или звук семантически.

### 2. Shared latent situation

Разные модальности проецируются в 16-мерное нормализованное пространство и объединяются с confidence weighting. Разброс между модальностями превращается в conflict/agreement signal.

### 3. Tiny learned world model

Reward predictor использует маленькую shared hidden network `18 → 8 → 1` с `tanh` hidden layer и action-specific output head. Обновление выполняется backprop/SGD на реальном reward. Параллельно обучается компактный transition-risk predictor.

Это всё ещё не deep learning framework и не foundation model. Это намеренно маленькая обучаемая модель для phone runtime.

### 4. Real runtime influence

P27 reward prediction добавляет ограниченный bias к action ranking. После feedback модель обучается на `stateBefore → action → reward → stateAfter`.

### 5. Model-based counterfactuals

`counterfactuals()` строит альтернативные действия **внутри learned model**. Это не заявление о реально произошедшем альтернативном мире.

### 6. Holdout evidence

Тест P27 содержит отдельный holdout measurement и требует роста после обучения. Это не доказывает универсальную способность к обучению, но доказывает конкретное параметрическое обучение и перенос внутри заданного feature space.

## Ограничения

Не заявляется:
- полноценный semantic vision;
- полноценный semantic audio;
- end-to-end neural perception from raw camera/microphone;
- универсальный world model;
- реальная физическая counterfactual intervention;
- consciousness;
- AGI.

## Phone budget

Нет внешних ML dependencies. Размер модели фиксирован и мал; обучение выполняется короткими локальными шагами. Raw audio ограничивается 3200 samples на вызов, vision features — 128 чисел. Это сознательное ограничение для среднего телефона.

## Regression contract

P27 не заменяет P23/P24/P25/P26, а надстраивается над ними. Schema повышена `29 → 30`.
