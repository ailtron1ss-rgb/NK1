# Neuro-Kurisu R19 — актуальные исследования и переносимые идеи

Дата: 2026-09-30
Release: 35.33.0 / R19

## 1. STALE — implicit conflict / stale memory

Paper: https://arxiv.org/abs/2605.06527

Ключевой вывод: обновление памяти и успешное извлечение новой записи ещё не гарантируют корректного поведения; agent должен отвергать устаревшие предпосылки и адаптировать downstream policy.

Перенос:
- R18 уже добавил implicit conflict arbitration.
- R19 добавляет provenance protection: более слабый источник не может автоматически вытеснить более сильный.
- Историческое состояние сохраняется; слабый конфликтный кандидат quarantine-ится вместо destructive overwrite.

## 2. Memory Anchors for Continual Robot Learning

Paper: https://arxiv.org/abs/2608.26545

Наблюдение: небольшое множество конфликтных «anchor» опытов может непропорционально сильно влиять на сохранение старых навыков; paper сообщает до 63% снижения forgetting на high-conflict task sequences при enrichment replay buffer anchors.

Переносимый принцип для Kurisu:
- memory replay должен учитывать конфликтность и anchor value, а не только recency/salience.
- это пока НЕ заявляется реализованным полностью; R20 candidate benchmark должен добавить anchor-aware replay в existing MemoryRetentionEconomy/P30 path.

## 3. Adaptive Memory Replay for Continual Learning

Paper: https://arxiv.org/abs/2404.12526

Идея: replay selection можно рассматривать как adaptive sampling/bandit, а не как uniform random replay.

Перенос:
- R18/R19 уже имеют learned memory value and outcome feedback.
- R20 может связать learned value с bounded replay sampler, но только после ablation against random/recency/conflict baselines.

## 4. Active Inference as test-time scaling for physical AI agents

Paper: https://arxiv.org/abs/2606.22813

Идея: model/policy может обновляться на test-time через posterior over policies driven by prediction error, а не только через offline parameter scaling.

Переносимый принцип:
- R18 contextual world calibration + R19 operation evidence создают необходимую evidential substrate.
- R20 candidate: bounded active-inference arbitration layer, но только как residual over canonical policy, не как второй policy writer.

## 5. All-Mem

Repository: https://github.com/LvCan926/All-Mem
Paper: https://arxiv.org/abs/2603.19595

Переносимые механизмы:
- bounded visible memory surface;
- online write / offline topology repair;
- non-destructive Split/Merge/Update;
- retrieval through visible anchors and typed links;
- recoverability to raw evidence.

Kurisu adaptation:
- не добавлять вторую graph database;
- использовать existing MemoryOS2 revisionGroups/links and bounded segment consolidation.

## 6. Что не переносим сейчас

Mamba/SSM stacks, external vector databases и cloud-only memory services не становятся canonical dependencies. Они остаются экспериментальными, пока не будет доказано, что прирост quality/latency/energy на Android превосходит стоимость интеграции.

## Next experiments

R20:
- Memory Anchors benchmark;
- replay sampler ablation: random vs recency vs learned-value vs conflict-anchor;
- 10k operation semantic replay;
- provenance-conflict matrix across source classes;
- bounded active-inference residual experiment;
- real Android endurance.
