# Design Decisions — P2551–P2558

## 1. Почему не делать отдельный giant policy
Новая causal-memory ветка не получает отдельного права выбирать действие. Она выдаёт bounded residual/action-bias, который проходит через существующий arbitration.

## 2. Почему memory usefulness учится после действия
Простого retrieval-hit недостаточно: воспоминание считается полезным только после фактического результата. Поэтому P2551 связывает retrieved memory IDs с delayed outcome credit.

## 3. Почему появились semantic rules
World-model prediction loss показывает ошибку, но не объясняет устойчивое правило перехода. P2552 сохраняет компактные action-conditioned transition rules, которые можно повторно использовать в близком контексте.

## 4. Почему selective foresight
Низкая уверенность world model не должна усиливать действие. Поэтому forecast проходит confidence/disagreement gate до policy residual.

## 5. Почему causal transfer benchmark
Точная копия контекста слишком узкая. Поэтому правила и matched traces оцениваются по cosine similarity, а не только по точному hash bucket. Это позволяет отдельно проверять transfer.

## 6. Почему не реализован полный PPO/GRPO внутри организма
Он слишком дорог и изменил бы режим обучения всего проекта. Текущий controller оставлен lightweight online learner; PPO/GRPO рассматриваются как отдельная экспериментальная offline/mobile-infeasible ветка.

## 7. Следующий приоритет
Дальше полезнее всего перейти к real sensory/embodied outcome grounding и к on-device profiling, а не бесконечно увеличивать внутреннюю сложность.
