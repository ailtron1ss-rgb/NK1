# P2627–P2640 — Research Index

Дата: 2026-09-18
Версия: 35.6.73
Релиз: P2640

## Что исследовалось

### 1. WorldEvolver / self-evolving world models
Источник: arXiv:2606.30639, *Self-Evolving World Models for LLM Agent Planning*.

Практически полезные идеи: episodic memory для реальных переходов, semantic memory из prediction-observation mismatch и selective foresight, который не пропускает low-confidence predictions дальше в decision loop.

В P2627–P2640 реализована облегчённая версия принципа: memory utility + live strategy selection + redirect при высоком prediction error/uncertainty. Параметры world model остаются отдельным контуром.

### 2. SelfMem / self-optimizing agent memory
Источник: arXiv:2607.03726, *SelfMem: Self-Optimizing Memory for AI Agents*.

Ключевая идея: стратегия работы памяти должна оптимизироваться по обратной связи, а не быть полностью жёстко заданной.

В P2627–P2640 это реализовано как 7-arm lightweight contextual strategy learner: retrieve / verify / simulate / abstain / explore / reflect / compress. Выбор обновляется после outcome прямо внутри текущей жизни организма.

### 3. Learning What to Remember
Источник: arXiv:2606.12945, *Learning What to Remember: A Cognitively Grounded Multi-Factor Value Model for Agentic Memory*.

Практически полезная часть: memory value не должен быть только similarity/recency; полезно учитывать reliability, goal relevance, value alignment/self relevance, utility и usage.

В P2627–P2640 введён compact memory-value gate с context match, identity match, goal match, reliability, causal importance, reward, novelty fit, recency и contradiction penalty.

### 4. Live self-improvement
Источник: arXiv:2608.26530, *PILOT in the Loop: Live Self-Improvement for Long-Horizon Agents*.

Ключевая идея: опыт должен иметь возможность изменить текущую активную траекторию, а не только обработаться после завершения эпизода.

В P2627–P2640 добавлен live redirect: при высоком риске система может перенаправить текущую policy bias в verify / explore / reflect / defer.

### 5. MemWM
Источник: arXiv:2608.07107, *MemWM: Memory-Augmented Text-Based World Model*.

Практически полезная идея: curated transition memory может сохранять hard-to-predict facts/rules и улучшать downstream planning.

В P2627–P2640 memory records теперь получают causal importance, reliability, contradiction и retention, а не только similarity score.

### 6. Cross-task skill transfer
Источник: arXiv:2608.20274, *Break It Down, Pass It On*.

Подтверждена необходимость оценивать skills по utility/abstractness/specificity и не переносить всё подряд. Этот принцип уже был внедрён P2613–P2626 и в новом блоке дополнительно связан с learned memory strategy.

### 7. Continual learning / world-model planning
Источник: arXiv:2507.09177, *Continual Reinforcement Learning by Planning with Online World Models*.

Практически полезная идея: world-model planning может поддерживать continual learning при последовательной смене задач без обязательного разрушения старых навыков.

В P2627–P2640 сохраняется разнесение world-model, procedural skills, autobiographical memory и policy-strategy adaptation вместо единого неконтролируемого online update.

## Гипотеза прироста

Внутренний synthetic A/B benchmark P2627–P2640 дал mean reward 0.734079 для adaptive memory/self-improvement против 0.638779 у фиксированной стратегии; абсолютная разница = +0.0953 reward units (~14.9% относительно baseline). Это локальный synthetic benchmark с контролируемыми shock-сценариями, а не универсальная оценка эффективности.

## Что пока НЕ доказано

- перенос на реальные внешние задачи без synthetic context;
- независимая multimodal grounding-проверка;
- физическая автономия на Android device;
- сознание/субъективный опыт;
- устойчивость learned memory policy на большом числе несхожих доменов.
