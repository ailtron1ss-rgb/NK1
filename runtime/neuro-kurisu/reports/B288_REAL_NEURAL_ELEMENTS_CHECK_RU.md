# B288 — проверка «настоящих нейроэлементов»

Не использовать слово «настоящий» как синоним биологической идентичности. Ниже разделены два вопроса: «реально исполняется?» и «биологически правдоподобно?»

| Механизм | Реально исполняется | Биологическая точность |
|---|---|---|
| recurrent neural state | Да | упрощённая |
| synaptic weights | Да | частично |
| activity-dependent plasticity | Да | частично |
| eligibility traces | Да | концептуально близко |
| third-factor neuromodulation | Да | сильно упрощено |
| E/I populations | Да | сильно упрощено |
| short-term depression | Да | приближённо |
| dendritic/context gating | Да | вычислительная аппроксимация |
| attractor dynamics | Да | computational |
| neural ablation | Да | causal test внутри модели |
| structural plasticity | Да в B269/B280 | приближённо |
| ion-channel dynamics | Нет | отсутствует |
| conductance-based membrane | Нет | отсутствует |
| explicit morphology | Нет | отсутствует |

Главное правило проекта: механизм считается «реальным» только после выполнения кода и отдельного теста поведения/ablation/persistence. Биологическая правдоподобность оценивается отдельно и не выводится из наличия класса или названия.
