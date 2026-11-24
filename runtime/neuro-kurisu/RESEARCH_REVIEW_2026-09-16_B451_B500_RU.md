# Исследования и алгоритмические направления — 2026-09-16

## 1. Causal long-horizon memory
AMA-Bench 2026 оценивает memory на непрерывных агентных траекториях и сообщает, что similarity-only retrieval теряет causal/objective information; предложенный AMA-Agent использует causality graph + tool-augmented retrieval и сообщает +11.16 percentage points относительно сильнейшего baseline в их эксперименте. Это поддерживает переход Neuro-Kurisu от pure similarity к causal/contextual retrieval. Источник: https://arxiv.org/abs/2602.22769

## 2. Dynamic procedural memory
ReMe 2026 рассматривает memory lifecycle как distillation успехов/ошибок, context-adaptive reuse и utility-based refinement/pruning. Для Neuro-Kurisu это особенно полезно, потому что предотвращает превращение autobiographical history в бесконечный append-only архив. Источник: https://aclanthology.org/2026.findings-acl.829/

## 3. Meta-cognitive memory abstraction
MCMA рассматривает саму абстракцию памяти как обучаемый cognitive skill и использует иерархию abstraction levels для selective reuse и transfer. Это прямо соответствует будущему B521–B540. Источник: https://aclanthology.org/2026.findings-acl.1535/

## 4. Self-improving skill libraries
SAGE (ACL 2026) использует skill library + sequential rollout + skill-integrated reward; в их AppWorld экспериментах сообщается +8.9% Scenario Goal Completion, -26% interaction steps и -59% tokens относительно их baseline. Эти числа относятся к другой LLM-системе и не переносятся напрямую на Neuro-Kurisu; для нашего проекта ценна сама архитектурная идея lifelong skill accumulation с validation. Источник: https://aclanthology.org/2026.acl-long.69/

## 5. Adaptive test-time compute
Constrained policy optimization для adaptive test-time compute сообщает до +12.8% relative accuracy improvement при matched compute budget на MATH и >91% imitation accuracy их learned allocator. Это мотивирует cost-aware cognitive routing, но не доказывает такой же прирост в Neuro-Kurisu. Источник: https://arxiv.org/abs/2604.14853

Работа Learning When to Think 2026 показывает learned выбор между NoThink/Short/Long режимами и сообщает 41% reduction mean response length в их setting. Для Neuro-Kurisu полезен сам принцип difficulty-conditioned compute, а не конкретная LLM-метрика. Источник: https://arxiv.org/abs/2608.20256

## 6. Latent world models
V-JEPA 2 развивает self-supervised latent world representations и action-conditioned prediction/planning. В Neuro-Kurisu это лучше связывать с уже существующими B261/B262/world ensemble owners, а не строить ещё один независимый world model. Источник: https://arxiv.org/abs/2506.09985

## 7. Что внедрено сейчас
B451–B500 переносит в lightweight phone-friendly form:
- hierarchical memory abstraction;
- transfer guard;
- strategy routing;
- skill transfer cache;
- cost-aware computation;
- world cross-check;
- expected-information-gain experiment pressure;
- multi-lesion causal verification.

## 8. Что делать с несколькими алгоритмами одновременно
Не следует складывать их как независимые additive bonuses. Лучший вариант — hierarchical routing:

context → difficulty/uncertainty → choose cognitive strategy → allocate compute → retrieve/plan/experiment → evaluate outcome → update router.

Именно router должен обучаться тому, какой механизм нужен сейчас.

## 9. Потенциальный прирост
Точные проценты заранее недоказуемы. Внешние публикации показывают, что memory, skill reuse и adaptive compute могут давать заметные gains в собственных benchmarks, но их результаты нельзя складывать арифметически.

Собственные тесты Neuro-Kurisu дают смешанную картину:
- targeted B451 benchmark: 85.71% hidden holdout;
- в одном fair compositional benchmark baseline и meta-controller оба получили 100%, то есть прямого выигрыша нет;
- старый B421–B450 benchmark baseline/lesions = 100%, поэтому он признан слишком лёгким;
- multi-lesion causal delta B451 ≈ 0.01809;
- B421 minimal budget: 0 rollouts;
- B421 research budget: 87,120 rollouts на 120 decisions.

Следовательно, потенциальный рост сейчас должен измеряться прежде всего на OOD, noisy, long-horizon, multi-lesion и transfer задачах, а не на простом synthetic accuracy.
