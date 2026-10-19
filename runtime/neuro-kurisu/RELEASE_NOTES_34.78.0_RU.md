# Neuro-Kurisu 34.78.0 — BIG PASS 104

## Тема
Evidence-Gated Retention & Transfer: replay переводится из внутреннего «механизма» в проверяемую исследовательскую цепочку.

## Основные изменения
- `ExperienceContinuumFabric` schema v5.
- Replay validation теперь хранит задержку, baseline, retention gain, task/context и evidence provenance.
- Добавлена ограниченная retention-статистика и log-delay curve fit; fit не считается доказательством биологической консолидации.
- Replay повышает подтверждённую стабильность только после `independentVerified=true`.
- Добавлено `MemorySkillEvidence` для связи памяти с procedural skill/variant без создания второго хранилища.
- Cluster replay counters теперь обновляются при фактической reactivation.
- Replay experiment считает paired effect только для реально совпадающих `pairKey + taskId + contextKey`.
- Непарные ON/OFF данные остаются observational и не получают paired effect.
- Core routing после независимой validation передаёт evidence в causal и unified learning с provenance `experience-replay`.
- Добавлен reusable `tools/evidence-gating-audit.mjs`.
- State schema: 112 → 113.

## Что намеренно не добавлено
- второй planner;
- второй canonical memory store;
- автономная генерация runtime-кода;
- автоматическое переписывание личности;
- claim о доказанном сознании;
- утверждение, что replay сам по себе равен консолидации.

## Проверки
Typecheck, Pass 103 regression, Pass 104 functional test, migration 112→113, evidence-gating audit, architecture/core-ownership/project-state/component-conflicts/source-truth/release-contract/integrity/forensics/hygiene, server smoke, mobile horizon 1000 и operational horizon 500 — PASS.
Operational horizon 1000 в этом проходе не подтверждён: запуск превысил лимит выполнения. Это не классифицируется как PASS.
