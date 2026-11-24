# Neuro-Kurisu B721–B900 — исследовательский обзор

## Зачем эта фаза

B720 уже объединил adaptive policy, hierarchical memory, world-model ensemble, skill transfer, regime detection, calibration и neural identity. Но его собственный executable benchmark показал слабое reversal/OOD-переключение. Поэтому B721–B900 концентрируется на замкнутом developmental learning fabric.

## Что внедрено

1. Temporal/hierarchical replay: приоритет строится из surprise, prediction error, verification и текущей OOD/regime-ситуации.
2. Temporal memory tree: компактное кластеризованное представление контекстов вместо бесконечного сырого буфера.
3. Action-conditioned world-model ensemble: несколько лёгких предикторов на действие с оценкой disagreement/variance.
4. Subgoal-conditioned planner: локальный план выбирает действия через world-model score, similarity к цели и ограниченный depth.
5. Selective verifier: сравнение прогноза с эмпирическими ближайшими эпизодами.
6. OOD/regime/reversal detector: при сдвиге правил фаза обучения автоматически смещается к recovery/verification/exploration.
7. Adaptive compute: compute budget масштабируется по uncertainty, prediction error, novelty, confidence и OOD.
8. 256-d distributed plastic identity: eligibility-trace-like обновление добавлено в тот же контур, а не как отдельная policy.
9. Stateful restart/persistence и lesion interface.

## Исследовательские ориентиры 2026

TiMem вводит temporal memory tree, semantic-guided consolidation и complexity-aware recall; в своей экспериментальной постановке авторы сообщают 75.30% на LoCoMo и 76.88% на LongMemEval-S при сокращении длины recalled memory на 52.20%. Это не прямой benchmark Neuro-Kurisu, но поддерживает идею вынести temporal hierarchy и complexity-aware retrieval в отдельный контролируемый слой.

SAGE показывает, что subgoal-conditioned proposal generation может резко помогать long-horizon latent planning; в заявленных задачах PushT success вырос с 12.7% до 64.7%, а OGBench Cube — с 26.7% до 67.3%. Это ориентир архитектурного принципа, а не прогноз для Neuro-Kurisu.

WorldEvolver показывает полезность test-time memory revision и selective foresight для action-conditioned world models; идея адаптирована здесь в лёгкий replay + verifier + disagreement контур.

Nature Communications (8 Sep 2026) обсуждает active inference и artificial reasoning как направление для объединения prediction error, belief updating и uncertainty-driven action. В текущей реализации используется только вычислительно безопасная идея uncertainty/error-gated action selection; это не утверждение биологической эквивалентности.

Adaptive test-time compute работы 2026 года поддерживают routing по сложности задачи и verifier-guided allocation. Поэтому B721–B900 не использует фиксированный deep режим на каждом шаге.

## Почему не копируем исследования буквально

Проект должен работать на среднем Android + Termux. Полные transformer-scale world models, крупные replay stores или тяжёлые search procedures здесь экономически неуместны. Поэтому внедрены bounded arrays, небольшой ensemble, 256D plastic state и ограниченный planner.

## Главный открытый результат

Стресс-тест 1000 решений реально показал execution, updates, replay, tree updates, 3000 model updates, 1000 planning steps, 6914 verifier calls, 1000 neural plastic updates и корректный restart persistence. Но специальный contextual reversal benchmark пока даёт около случайного уровня при argmax action-bias. Это означает, что следующий этап должен научить meta-policy использовать контекстные policy parameters сильнее, а не просто накапливать больше памяти.

## Источники

- TiMem, ACL Findings 2026: https://aclanthology.org/2026.findings-acl.1091/
- SAGE: https://arxiv.org/abs/2607.17973
- WorldEvolver: https://arxiv.org/abs/2606.30639
- Active inference and artificial reasoning, Nature Communications, 8 Sep 2026: https://www.nature.com/articles/s41467-026-77209-5
- Adaptive test-time compute: https://arxiv.org/abs/2602.01070
