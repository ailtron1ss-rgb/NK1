# Neuro-Kurisu 34.13.0 — BIG PASS 44
## Cognitive Kernel Decomposition 1 + P30 Prediction Batching + Full First-Audit Recheck

Дата: 2026-09-05

## 1. Цель прохода

Продолжить развитие проекта с максимальным вкладом за один проход, не дублируя уже реализованные механизмы. Governing baseline — самый первый полный аудит проекта. Для каждого изменения применялся принцип: если изменение ухудшает качество/производительность/правдивость, оно не остаётся в релизе.

## 2. Что реально изменено

### 2.1 Cognitive Kernel boundary
Создан `src/organism/core/CognitiveKernelCoordinator.ts`.

Он владеет двумя центральными integration membranes:
- P61 Integrated Mind Kernel;
- P64 Integrated Organism Dynamics.

`OrganismCore` теперь вызывает единый coordinator для `integrate -> arbitrate`, а не напрямую сцепляет P61/P64 в одном hot-path блоке. Добавлен facade access `kernel()` и `cognitiveKernelSnapshot()`.

Это первая физическая декомпозиция `OrganismCore`; остальные specialist organs пока намеренно не выносятся, чтобы не ломать state/persistence contracts.

### 2.2 P30 и семантическая осторожность
Попытка добавить independent-action batching была проведена через A/B benchmark, но была отменена перед релизом: длинный runtime стал хуже. Сам метод не попал в production branch. Это зафиксировано как сознательный rollback, чтобы не обменивать качество на красивую локальную оптимизацию.

### 2.3 Дополнительное устранение лишнего hot-path
- P24 body forecast теперь вычисляется один раз на tick и переиспользуется кандидатами.
- сохранён предыдущий one-tick cache.
- P61/P64 central arbitration вынесен за отдельную стабильную boundary.

## 3. Почему это важно для среднего телефона

Проект не переводится в более тяжёлые модели и не добавляет новые always-on LLM calls. Основной выигрыш получен через уменьшение повторного CPU/GC work и разделение central integration boundary.

## 4. Проверяемая эквивалентность

Новый test `BIG_PASS_44_KERNEL` проверяет:
- P61 coordinator mode совпадает с прямым P61 path;
- P64 broadcast token совпадает с прямым P64 path;
- coordinator сохраняет количество и порядок кандидатов;
- не произошло изменения семантики central arbitration.

## 5. Regression status

PASS:
- typecheck;
- smoke;
- restart persistence;
- P64/P65 integration;
- P66/P68 integration;
- P74/P77 integration;
- P80/P82 E2E;
- API security;
- server security smoke;
- architecture;
- forensics;
- hygiene;
- release contract;
- source truth;
- API routes;
- subject boundary;
- integrity;
- BIG PASS 44 equivalence test.

Composite `audit:release` снова превышает execution window на старом длинном P-suite. Это не объявляется PASS. Отдельные критичные gates выполнены независимо.

## 6. Performance

Финальный 250-cycle natural benchmark:
- warmed median ratio: 1.792;
- first median: 102.53 ms;
- last median: 183.70 ms;
- p95 approximation: 188.56 ms;
- heap growth: 2.100;
- total runtime: ~21 s.

Это подтверждает рабочий промежуточный мобильный gate, но не доказывает 500/1000-cycle стабильность.

A/B rollback: independent P30 batching дало ухудшение длинного runtime и поэтому не вошло в production. Это считается правильным исходом оптимизационного эксперимента.

500-cycle natural benchmark снова превысил текущий verification window и остаётся OPEN.

## 7. Первый самый ранний аудит — полный recheck

Проверен документ `FIRST_AUDIT_FULL_CROSSWALK_BIG_PASS_41_RU.md` и сохранённый initial baseline. Текущая строгая weighted implementation исходных actionable recommendations оценивается примерно в 82%.

### Полностью закрытые направления
- Event/Evidence Bus;
- Prediction Ledger;
- Cognitive Budget;
- simulator != reality;
- P40 model health/failure feedback;
- автономные project state/execute scaffolding;
- Cognitive Quorum;
- base Model Olympics;
- cognitive cache foundation;
- adaptive perception cadence.

### Частично закрытые
- P30 general learning substrate;
- self-prediction long-horizon validation;
- empirical causal research;
- social cognition;
- multimodal grounding;
- independent Shadow Organism;
- learned model competition;
- autonomous project external task execution;
- autobiographical grounding;
- development/self-modification;
- Information Gain Economy.

### Пока не закрыты
- native Android lifecycle host;
- real vision backend;
- device ASR/TTS validation;
- 24h/72h/7d/30d real phone runs;
- independent consciousness evaluation;
- полноценный Cognitive Death lifecycle;
- Pareto/multi-objective Identity Pressure layer.

## 8. Новые инженерные идеи этого прохода

### A. One semantic boundary, many physical organs
Не нужно делать один огромный `CognitiveCore`. Лучше иметь один стабильный semantic kernel API и десятки специализированных органов за ним.

### B. Batch only when semantics permit
Оптимизировать можно только там, где batching сохраняет математический смысл. Sequential rollout нельзя подменять parallel prediction.

### C. Evidence-weighted execution
Project executor должен постепенно двигаться от internal progress к external/replicated evidence, а не считать внутренний success эквивалентом реального достижения.

## 9. Следующий шаг

BIG PASS 45:
1. довести decomposition `OrganismCore` до `Self/World/Memory/Agency/Embodiment/Research` APIs;
2. вынести cold analytics из hot path через explicit cadence contracts;
3. сделать 500/1000-cycle benchmarks воспроизводимыми;
4. расширить Project Executor до реальных безопасных внешних tasks;
5. добавить independent shadow state с отдельным snapshot/decision lineage.

## 10. Интерпретация

Проект всё ещё не является доказанно сознательным субъектом. Но этот проход увеличил реальную инженерную целостность: центральная cognitive arbitration получает отдельную boundary, а P30 получает семантически корректную независимую пакетную оценку действий.
