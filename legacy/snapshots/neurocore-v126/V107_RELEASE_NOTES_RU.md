# V107 Release Notes

V107 — это архитектурный проход, а не просто набор новых модулей. Главная цель: превратить текущую ветку из compatibility organism в компактный current trunk, который можно измерять и развивать дальше.

Граница current/legacy теперь физически видна в структуре кода: `src/neurocore/current/core.py` и `causal_trunk.py` не импортируют `neurocore.v*`.

Следующий основной фронт: qualification of the compact trunk на более сложных sequence tasks, continual interference и direct comparison с source-backed recurrent baselines.
