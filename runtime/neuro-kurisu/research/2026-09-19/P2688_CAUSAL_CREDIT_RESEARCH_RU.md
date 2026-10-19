# P2688 — исследовательская база: delayed credit / replay

## Что проверено

1. ICLR 2026, *Learning From the Past with Cascading Eligibility Traces*: каскадные eligibility traces уменьшают проблему временного смешивания событий при длинной задержке и позволяют точнее хранить следы для delayed credit assignment. Это стало основанием для перехода P2688 от одного экспоненциального затухания к трём временным каскадам: short / medium / long.

2. PMLR 2026, *Replay can provably increase forgetting*: replay не гарантирует пользу; результат зависит от выбранных samples и связи между задачами. Поэтому P2688 требует независимой validation перед усилением политики.

3. ACL 2026, *FOREVER*: replay scheduling полезно связывать с модельным временем и forgetting curve, а не только с номером шага. Это оставлено как следующий отдельный этап, поскольку текущий P2687 уже содержит bounded multi-timescale lanes, но ещё не полноценный model-change clock.

4. PMLR 2026, *Revisiting Replay and Gradient Alignment for Continual Pre-Training*: replay и alignment могут повышать стабильность continual learning. В нашем проекте этот результат трактуется как аргумент за отдельный interference/evidence gate, а не за бесконтрольное усиление replay.

## Решение P2688

Новая причинная заслуга replay события вычисляется только при наличии соответствующей validation. Итоговый credit зависит от retention gain, transfer, interference, priority/learning opportunity и временной eligibility. Временная часть теперь каскадная: 12 часов, 3 дня, 14 дней.

Это экспериментальная алгоритмическая аппроксимация, а не биологическое утверждение.

## Ссылки

- https://proceedings.iclr.cc/paper_files/paper/2026/hash/e647dad9086b5a4cc136e1d1926cc172-Abstract-Conference.html
- https://proceedings.mlr.press/v330/mahdaviyeh26a.html
- https://aclanthology.org/2026.acl-long.1144/
- https://proceedings.mlr.press/v330/abbes26a.html
