# Research Review B621–B720 — 16.09.2026

## Что изменилось в научном контуре

B621–B720 строится вокруг пяти направлений:

1. Обучаемый выбор когнитивной стратегии.
2. Временная иерархия автобиографической памяти.
3. Action-conditioned world model и bounded planning.
4. Regime-shift detection и ускоренная пластичность.
5. Распределённый neural identity code.

## Внешние ориентиры

**TiMem (ACL Findings 2026)** строит Temporal Memory Tree, объединяя temporal hierarchy, semantic-guided consolidation и complexity-aware recall. Авторы сообщают 75.30% на LoCoMo и 76.88% на LongMemEval-S, одновременно сокращая recalled memory length на 52.20% на LoCoMo. Это не переносимые на Neuro-Kurisu числа, а внешний ориентир дизайна. Source: https://aclanthology.org/2026.findings-acl.1091/

**H-MEM (EACL 2026)** использует иерархическую память для long-term reasoning с целью снизить стоимость широкого retrieval. Source: https://aclanthology.org/2026.eacl-long.15/

**MCMA (ACL Findings 2026)** рассматривает memory management как meta-cognitive skill и учит систему выбирать уровень абстракции/переноса памяти. Это напрямую мотивирует B621 strategy router. Source: https://aclanthology.org/2026.findings-acl.1535/

**MemForest (2026)** разделяет memory construction и hierarchical temporal indexing, делая write-path более параллельным и локальным. Для проекта это аргумент в пользу bounded local refresh вместо глобальных пересборок памяти. Source: https://arxiv.org/abs/2605.23986

**World Action Planner (2026)** использует action-conditioned world models и iterative planning/search по imagined rollouts. Это мотивирует дальнейшее развитие нашего action-conditioned world path. Source: https://arxiv.org/abs/2607.27599

**SAGE (2026)** показывает, что subgoal-conditioned proposals могут существенно помогать long-horizon planning в latent world models. Source: https://arxiv.org/abs/2607.17973

**LEAP (2026)** исследует energy-based optimization в latent action planning и сообщает рост mean success с 77.5% до 94.8% в своих matched control experiments. Эти цифры относятся только к их control domains и не являются прогнозом для Neuro-Kurisu. Source: https://arxiv.org/abs/2609.03294

**Adaptive test-time reasoning (ICLR 2026 review/papers)** поддерживает route-then-execute и budget-aware reasoning вместо одинакового compute на каждом входе. Source: https://openreview.net/pdf?id=3kvV1nfWVq

## Что сознательно НЕ копировалось

Мы не импортировали чужой framework целиком. Все B621–B720 механизмы реализованы как lightweight bounded components, совместимые с существующим canonical decision owner и mobile/Termux ограничениями.
