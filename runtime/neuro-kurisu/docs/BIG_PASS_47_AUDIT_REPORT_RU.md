# Neuro-Kurisu 34.17.0 — BIG PASS 47
## External Project Engine + Skill Acquisition Benchmark + Subsystem Registry

Дата: 2026-09-06
Статус: research-release

## 1. Baseline и принцип

Главный baseline: самый первый полный аудит 2026-09-05 и последняя сохранённая crosswalk-матрица BIG PASS 46. Повторно проверены изменения 34.3–34.16. Запрещено считать score/flag доказательством свойства без causal runtime effect или проверяемого теста.

## 2. Что реально изменено

### 2.1 ExternalProjectResearchTool
Добавлен реальный read-only HTTPS research adapter для autonomous projects.

Свойства:
- выключен по умолчанию;
- включается `NEURO_PROJECT_NETWORK_ENABLED=1`;
- host allowlist через `NEURO_PROJECT_NETWORK_ALLOWLIST`;
- только HTTPS;
- блокировка localhost/private IP литералов;
- redirects не следуются автоматически;
- лимит размера ответа;
- timeout;
- SHA-256 content hash;
- bounded snippet/title/content-type/status;
- bounded in-memory response cache with TTL/max-entry limits;
- `independenceKey` uses source identity (final hostname), while `contentHash` remains a separate data-identity signal;
- external observation получает provenance и independenceKey.

Важно: успешный HTTP fetch доказывает только существование/получение внешнего ресурса, а не истинность утверждений внутри него. Система не маркирует содержимое как factual truth без дальнейшей проверки.

### 2.2 Project executor bridge
`executeNextProjectStep()` теперь может принимать explicit tool input и сам восстанавливает executor state, если он ещё не был создан для выбранного проекта.

Для project step сохранён `toolInput`, что позволяет безопасно передать URL/read-only parameters без доступа к внутреннему массиву state.

При успешном external research:
- создаётся external-api evidence record;
- project получает external evidence;
- executor получает успешный outcome;
- skill acquisition benchmark получает holdout sample;
- execution event сохраняет факт externalEvidence.

### 2.3 SkillAcquisitionBenchmark
Добавлен отдельный поведенческий benchmark:
- baseline mean;
- holdout mean;
- gain01;
- novel contexts;
- phase tracking;
- bounded recent samples;
- persistence через organism state schema 90.

Это не доказательство появления общего человеческого навыка. Это измеритель того, меняется ли outcome на новых контекстах относительно baseline.

### 2.4 CognitiveSubsystemRegistry
Создан реальный registry boundary для семи subsystem ports:
Self, World, Memory, Agency, Embodiment, Research, Governance.

Добавлены:
- manifest;
- health probe;
- probe latency;
- error status;
- short-lived health cache.

Это стадия физической границы, но НЕ полный physical extraction OrganismCore. Поэтому extraction остаётся partial.

### 2.5 Additional correction
`SubsystemRegistry.health()` первоначально был слишком декоративным: проверял только наличие объекта. Он переработан в actual read-probe с latency/error и cache.

### 2.6 Schema/release
Application: `34.17.0`
State schema: `90`
Phase: `Stage-2/external-project-engine-skill-benchmark`

Schema повышена только потому, что новый `SkillAcquisitionBenchmark` действительно сохраняется в persisted state.

## 3. Regression evidence

PASS:
- TYPECHECK
- BIG_PASS_47_EXTERNAL_SKILL
- BIG_PASS_47_INTEGRATION
- SUBSYSTEM_REGISTRY
- BIG_PASS_44_KERNEL
- BIG_PASS_45_ARCHITECTURE_PERFORMANCE
- BIG_PASS_46_MULTI_PROJECT_MODELS
- P64/P65 integration
- P67 project evidence
- P31/P32/P41 truthfulness
- identity lock
- concurrency
- replay
- restart persistence
- operational hardening
- server smoke
- API security
- source truth
- architecture
- forensics
- hygiene
- release contract
- release source
- integrity
- subject boundary
- API routes
- lockfile

## 4. Long-horizon results on 34.17.0

### 250
`LONG_HORIZON_OPERATIONAL_250=PASS`
- warmedMedianRatio: 1.499
- firstMedianMs: 17.82
- lastMedianMs: 26.70
- p95Approx: 31.71
- heapGrowth: 2.282

### 500
`LONG_HORIZON_OPERATIONAL_500=PASS`
- ratio: 4.028
- firstMs: 7.99
- lastMs: 32.19
- p95: 35.62
- heapFirst: 24.95 MB
- heapLast: 98.10 MB

### 1000
`LONG_HORIZON_OPERATIONAL_1000=PASS`
- ratio: 1.928
- firstWarmMs: 18.25
- lastMs: 35.20
- p95: 40.29
- heapFirst: 48.31 MB
- heapLast: 89.66 MB
- memory: 224

Это воспроизводимый operational milestone на текущем host. Это не замена 24h/72h/7d/30d физического Android теста.

## 5. Первый аудит — строгая crosswalk

Повторный review 20 пунктов первого аудита теперь оценивается более консервативно:
- fully/strongly implemented: 11
- partial: 6
- not proven: 3

Если full=1, partial=0.5, not proven=0, получается `14.0/20 = 70%` по строгой 20-пунктной схеме.

Это осознанная коррекция прежних завышенных оценок. Более высокие значения в текущей документации относятся к более подробным weighted engineering sub-tasks, а не к 20 исходным направлениям.

## 6. Готовность

| Область | % |
|---|---:|
| Mobile readiness | 84 |
| Runtime robustness | 92 |
| Persistence | 94 |
| Evidence quality | 95 |
| Cognitive Budget | 91 |
| Prediction infrastructure | 92 |
| Learning | 80 |
| Agency | 89 |
| Autonomous projects | 90 |
| Reality grounding | 90 |
| Self / Identity | 78 |
| Long-horizon | 86 |
| Architecture consolidation | 70 |
| Perception | 66 |
| Native Android lifecycle | 20 |
| Social cognition | 48 |
| Consciousness research readiness | 53 |

## 7. Что остаётся

### Highest priority
1. Полный physical extraction Self/World/Memory/Agency/Embodiment/Research/Governance из OrganismCore.
2. Реальный long-running external project с safe network adapter.
3. Independent Shadow Organism.
4. Learned World Model tournament на реально holdout/out-of-distribution данных.
5. Skill acquisition benchmark на новых, не повторяющихся контекстах.
6. Native Android host/lifecycle.
7. Real semantic vision backend.
8. Social cognition.
9. 24h/72h/7d/30d device campaigns.
10. Empirical consciousness evaluation.

## 8. Новые собственные идеи

### Evidence Firewall
Каждый external result сначала попадает в `observation quarantine`, а не напрямую в belief. Только после corroboration/replication он может изменять high-confidence beliefs.

### Skill Transfer Delta
Навык считается сильным только если улучшение переносится на новый contextKey, а не только на тот же сценарий.

### Project Memory Replay
После завершения проекта организм должен суметь восстановить не только результат, но и почему некоторые шаги провалились, какие assumptions изменились и какая стратегия оказалась дешевле.

## 9. Следующий BIG PASS

### BIG PASS 48
`OrganismCore Decomposition 2 + real external project loop`

Цель: превратить registry из semantic boundary в физически разделённые subsystem implementations, одновременно подключив safe external research workflow с независимой верификацией результата.
