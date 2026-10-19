# Internet research review — 2026-09-16

## 1. Long-horizon memory
AMA-Bench показывает, что agent memory оценивается на непрерывных длинных траекториях, а similarity-only retrieval может терять причинные и объективные связи; авторы предлагают causality graph + tool-augmented retrieval. В B421–B450 это превращено в bounded causal-edge retrieval, context gating и отдельную процедурную память.
Source: https://arxiv.org/abs/2602.22769

## 2. Dynamic procedural memory
ReMe предлагает lifecycle: distillation успехов/ошибок, context-adaptive reuse и utility-based refinement/pruning. Наш B422 использует ту же общую идею, но в lightweight deterministic form с confidence, utility, success/failure counts и bounded memory.
Source: https://aclanthology.org/2026.findings-acl.829/

## 3. Self-evolving agents
MUSE использует post-execution critique и иерархическую память для накопления опыта и долгих workflows. Для Neuro-Kurisu это соответствует переходу от archive-only memory к development loop: outcome → refinement → future policy support.
Source: https://aclanthology.org/2026.findings-acl.1522/

## 4. Continual learning / continuum memory
Nested Learning рассматривает continual learning как nested/multi-timescale optimization и continuum memory. B401–B420 уже содержит multi-timescale state, а B421–B450 добавляет routing и lifecycle для выбора, когда и какой механизм использовать.
Source: https://arxiv.org/abs/2512.24695

## 5. Long-term memory during inference
Titans/MIRAS исследуют memory modules, которые обновляются во время inference/test-time. Для проекта это поддерживает принцип online memory adaptation без обязательного полного retraining всей модели.
Source: https://research.google/blog/titans-miras-helping-ai-have-long-term-memory/

## 6. Latent world models
V-JEPA 2 показывает практический путь: self-supervised latent prediction + action-conditioned world model + planning в latent space. B425/B426 используют lightweight analogue: hierarchical latent-like state prediction и multi-horizon rollouts.
Source: https://arxiv.org/abs/2506.09985

## 7. Adaptive test-time compute
Работы 2026 года по adaptive test-time compute показывают, что выгоднее учиться распределять вычисления по трудности задачи, а не использовать фиксированный бюджет. В B424 это реализовано как minimal/normal/deep/research режимы. Zhai et al. сообщают до 12.8% relative accuracy improvement under matched compute budget в своих LLM experiments; это не переносится напрямую на наш runtime, но подтверждает исследовательскую ценность adaptive allocation.
Sources: https://arxiv.org/abs/2604.14853 ; https://arxiv.org/abs/2608.20256

## 8. Coordinated multi-agent reasoning
ACL 2026 analysis показывает, что debate и mixture-of-agents могут давать более выгодный accuracy/compute trade-off при определённых бюджетах; PaCoRe развивает parallel coordinated reasoning. Для нашего телефона это не означает запуск множества тяжёлых моделей: B426 использует несколько дешёвых bounded rollouts внутри одного runtime.
Sources: https://aclanthology.org/2026.acl-srw.1/ ; https://aclanthology.org/2026.acl-long.1253/

## Что это даёт проекту
Самая перспективная комбинация на текущем этапе: causal memory + procedural refinement + meta-routing + adaptive compute + hierarchical world prediction + bounded parallel rollouts + calibration. Её нужно тестировать по ablation и hidden/holdout задачам, а не принимать как гарантированный универсальный прирост.
