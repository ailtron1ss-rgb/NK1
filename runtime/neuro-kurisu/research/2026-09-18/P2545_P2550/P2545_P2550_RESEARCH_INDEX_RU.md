# Neuro Kurisu — Research Memory P2545–P2550 (2026-09-18)

## Назначение
Этот раздел сохраняет исследования, использованные непосредственно при проектировании P2545–P2550, чтобы следующие проходы могли восстановить не только код, но и инженерную логику выбора.

## 1. BrainTrace — linear-memory online learning for SNN
**Источник:** Nature Communications, 2026.
**Ключевая идея:** online learning в SNN можно организовать с линейной памятью eligibility traces; авторы выводят pre-post propagation и показывают, что sparse/event-driven структура может уменьшить память, сохраняя пригодный temporal credit signal.
**Что перенесено:** P2540/P2545 используют компактный temporal credit path и sparse active updates, а legacy full traces оставлены как контроль/миграционный режим.
**Ограничение:** мы не реализуем полный BrainTrace/D-RTRL; наша реализация — bounded project-specific approximation.
**URL:** https://www.nature.com/articles/s41467-026-68453-w

## 2. Memory-R1 — learned memory operations
**Источник:** ACL 2026.
**Ключевая идея:** memory manager получает отдельные действия ADD / UPDATE / DELETE / NOOP и обучается outcome-driven RL вместо статических heuristics.
**Что перенесено:** P2545 содержит lightweight online learned memory-operation policy для ADD/UPDATE/RETRIEVE/DELETE/NOOP. Policy обновляется по reward/prediction error.
**Ограничение:** не используется PPO/GRPO и нет LLM memory manager; применяется компактная локальная policy, подходящая для телефона.
**URL:** https://aclanthology.org/2026.acl-long.583/

## 3. Agentic Memory (AgeMem) — unified STM/LTM management
**Источник:** ACL 2026.
**Ключевая идея:** long-term и short-term memory управление объединяется с policy агента; операции store/retrieve/update/summarize/discard рассматриваются как действия агента.
**Что перенесено:** память P2545 включена прямо в нейронный decision loop, а retrieval utility и epistemic disagreement могут влиять на action residual.
**Ограничение:** проект не копирует LLM-specific training procedure.
**URL:** https://aclanthology.org/2026.acl-long.981/

## 4. DRMCL — feedback-regulated dual-role consolidation
**Источник:** PubMed / journal article, 2026.
**Ключевая идея:** replay полезнее при разделении core samples и decision-sensitive boundary samples и feedback control, особенно при ограниченной памяти.
**Что перенесено:** память P2545 защищает utility/identity anchors, считает contradiction/strength/protection и запускает selective sleep consolidation.
**Ограничение:** не переносим CIFAR-10 результаты напрямую на Neuro Kurisu.
**URL:** https://pubmed.ncbi.nlm.nih.gov/42614398/

## 5. Unified Memory Agent (UMA)
**Источник:** arXiv 2026.
**Ключевая идея:** компактный core summary + структурированный memory bank с proactive consolidation для динамических потоков.
**Что перенесено:** P2545 поддерживает compact latent forecast + structured memory records, а не только FIFO replay.
**URL:** https://arxiv.org/abs/2602.18493

## 6. Variable-Length Latent World Models
**Источник:** arXiv 2026.
**Ключевая идея:** обучение сразу на нескольких action-conditioned horizons уменьшает mismatch между one-step prediction и long-horizon planning.
**Что перенесено:** P2545–P2550 обучают horizon 1/2/4 online и измеряют disagreement между ними как epistemic signal.
**URL:** https://www.alphaxiv.org/abs/2606.21775

## 7. Continual Test-Time Adaptation / STAD
**Источник:** ICLR-era / state-space test-time adaptation literature.
**Ключевая идея:** deployed recurrent/state-space systems должны адаптироваться к постепенно меняющемуся распределению, но избегать error accumulation.
**Что перенесено:** anti-forgetting gate, stability gate и bounded online policy update.
**URL:** https://arxiv.org/abs/2407.12492

## 8. Mobile agent memory benchmark
**Источник:** MobiSys Workshop 2026.
**Ключевая идея:** persistent on-device agents должны учитывать memory, latency, token/context and privacy budgets одновременно.
**Что перенесено:** compute governor связывает memory budget, replay budget, sleep budget и resource signals; architecture остаётся bounded для телефона.
**URL:** https://doi.org/10.1145/3812836.3814752

## 9. Continual World Model / EvoAgent
**Источник:** 2025.
**Ключевая идея:** world model должен обновляться в closed loop и помогать long-horizon agentic planning, а не быть только статическим predictor.
**Что перенесено:** multi-horizon transition learning и disagreement-aware action pressure.
**URL:** https://arxiv.org/abs/2502.05907

## Экспериментальная синтеза
Нельзя складывать проценты улучшений из разных публикаций: задачи, модели и hardware различаются. Поэтому проект использует ablation-by-ablation validation.

Текущая инженерная гипотеза для P2545–P2550:
- linear/sparse credit: снижает memory/compute pressure;
- learned memory operations: уменьшают бесконтрольное накопление опыта;
- pattern separation + protected anchors: уменьшают interference;
- multi-horizon predictor: улучшает long-horizon causal consistency;
- adaptive budget: переводит качество/стоимость в один управляемый trade-off;
- selective sleep: переносит consolidation в низконагруженные окна.

Потенциальный общий эффект рассматривается только как область эксперимента, а не обещание: наиболее вероятный путь — небольшое/среднее улучшение memory retention и long-horizon prediction при одновременном снижении лишнего replay, а не мультипликативное сложение всех опубликованных процентов.
