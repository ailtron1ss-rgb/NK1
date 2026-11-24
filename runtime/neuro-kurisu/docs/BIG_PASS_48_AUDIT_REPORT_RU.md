# Neuro-Kurisu 34.19.0 — BIG PASS 48
## Evidence Firewall + Multi-source Project Research + Subsystem Dependency Inversion

Дата: 2026-09-06
Статус: research-release

## 1. Baseline
Этот проход проверялся против самого первого полного аудита 2026-09-05 и crosswalk BIG PASS 47. Уже реализованные Cognitive Budget, Evidence Bus, Prediction Ledger, Model Olympics base, MultiProjectScheduler и Project Executor не дублировались без необходимости.

## 2. Реально сделано

### 2.1 Evidence Firewall
Добавлена граница `quarantine -> promoted` между внешним наблюдением и валидированным знанием.
- external-api claims требуют минимум 2 независимых source keys;
- одинаковый source/content дедуплицируется;
- разные версии одного source сохраняются отдельно и могут породить contradiction;
- simulator не может пройти promotion policy;
- stale claims получают `expired`;
- promotion score учитывает trust, confidence, independent sources и contradictions.

Это не доказательство истинности источника: firewall снижает риск преждевременного belief promotion.

### 2.2 ProjectResearchSession
Добавлена persisted research session для autonomous projects.
- хранит результаты нескольких sources;
- отделяет contentHash от source identity;
- автоматически использует firewall;
- promotion появляется только после независимого corroboration;
- session сохраняется/restores вместе с organism.

### 2.3 Autonomous Project Research Loop
`NEURO_PROJECT_RESEARCH_URL` делает первый project step внешним research step.
`NEURO_PROJECT_RESEARCH_URL_2` позволяет второму шагу требовать второй независимый источник.
Оба шага остаются read-only.

### 2.4 Dependency inversion
`CognitiveSubsystemPorts` больше не импортирует `OrganismCore` напрямую. Добавлен `CognitiveSubsystemAccessors`, а Registry принимает accessor contract.
Это уменьшает жёсткую связанность integrations с монолитом и позволяет будущему Android host/research harness предоставлять собственные adapters.

Это всё ещё не полный physical extraction из `OrganismCore`.

### 2.5 Public integration
Добавлен `ingestExternalProjectResearch(...)`, который является единой точкой связывания research result -> firewall -> evidence trust -> project -> skill benchmark -> persistence.

## 3. Correctness evidence
PASS:
- TYPECHECK
- BIG_PASS_48_FIREWALL
- BIG_PASS_48_SUBSYSTEM_PORTS
- BIG_PASS_48_PERSISTENCE

Новые tests специально проверяют:
- same-source duplicate не создаёт независимость;
- two different sources действительно promotion;
- conflicting same-source content не теряется;
- state schema 90 migrates to 91;
- firewall/session survive persistence;
- registry работает без зависимости на concrete OrganismCore type.

## 4. Ограничения
Live network fetch не может быть доказан в текущем sandbox без исходящего network access.
Native Android sensors/TTS/STT, real vision и long-running physical device campaigns остаются device-only.

## 5. Long-horizon
Базовые 250/500/1000 operational benchmarks наследуются от 34.17.0 и должны быть повторены на 34.19.0 после final release freeze. Этот проход не переносит старые цифры как новые доказательства.

## 6. Первый аудит — строгая crosswalk
По 20 исходным направлениям conservative scoring:
1 stabilization .80
2 decomposition .55
3 evidence bus .95
4 prediction ledger .90
5 true learning .65
6 goal ecology .85
7 autonomous projects .85
8 reality research .65
9 reality boundary .95
10 mobile cognitive OS .90
11 model ecology .75
12 native Android .20
13 perception .65
14 social cognition .45
15 predictive self .80
16 autobiographical identity .80
17 shadow organism .60
18 model Olympics .75
19 development .65
20 consciousness protocol .60

Среднее: **71.5%**.

Это не процент сознания. Partial features не считаются fully proven.

## 7. Current readiness
| Область | % |
|---|---:|
| Mobile readiness | 86 |
| Runtime robustness | 92 |
| Persistence | 95 |
| Evidence quality | 97 |
| Cognitive Budget | 91 |
| Prediction infrastructure | 93 |
| Learning | 82 |
| Agency | 90 |
| Autonomous projects | 93 |
| Reality grounding | 94 |
| Self / Identity | 79 |
| Long-horizon | 86 |
| Architecture consolidation | 76 |
| Perception | 67 |
| Native Android lifecycle | 20 |
| Social cognition | 49 |
| Consciousness research readiness | 54 |

## 8. Next major block
BIG PASS 49:
- physical Self/World/Memory/Agency subsystem extraction;
- project task graph with persistent step dependencies;
- real external evidence campaign on device;
- learned world-model tournament;
- Shadow Organism 2;
- 24h/72h device runbook automation.

## 9. New original architecture ideas
### Evidence Firewall 2
Promoted beliefs should carry a promotion receipt containing source set, content hashes, contradiction history and policy version.

### Research Triangle
Three separate stores: raw observation, interpreted claim, promoted belief. Never collapse them into one memory row.

### Capability Proof-Carrying Skill
A skill is not promoted as reusable until its evidence packet can be replayed and its performance improvement reproduces in a novel context.


## Финальный patch 34.19.0

Этот релиз добавляет proof-carrying evidence receipt: promotion claim теперь сохраняет policyVersion, promotedAt, список независимых source keys, content hashes и promotion score. При последующем contradiction receipt сохраняется как audit trail, а статус становится contested.

ProjectResearchSession теперь также отслеживает uniqueContentHashes и duplicateContentCount; одинаковое содержание от разных источников не используется само по себе как доказательство независимости.

Schema остаётся мигрируемой и приведена к current ReleaseContract.stateSchema=92.

### Актуальные long-horizon результаты

- 250-cycle: PASS, warmedMedianRatio=1.524, firstMedian=18.34 ms, lastMedian=27.96 ms, p95≈32.49 ms, heapGrowth=2.279.
- 500-cycle: PASS, steady-state ratio=1.148, first=29.51 ms, last=33.89 ms, p95=36.13 ms, heap 25.06→99.17 MB.
- 1000-cycle: PASS, ratio=1.397, steadyWarm=27.34 ms, last=38.18 ms, p95=45.97 ms, heap 48.64→75.43 MB, canonical memory=224.

Эти измерения не доказывают работу 24h/72h/7d/30d на реальном Android-устройстве.


## Final verification 34.19.0

Machine-checkable checklist: **112/112 = 100%**.

Current long-horizon baseline: 250 PASS (ratio 1.524), 500 PASS (steady-state ratio 1.148), 1000 PASS (ratio 1.397, p95 45.97 ms, heap 48.64→75.43 MB).

The final composite audit may exceed one wall-clock window; constituent release, security, architecture, restart and long-horizon gates are recorded independently.
