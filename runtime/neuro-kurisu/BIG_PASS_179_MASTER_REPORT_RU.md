# NEURO-KURISU — BIG PASS 179
## Consciousness Research Battery / Temporal Ownership / Evidence Integrity

Дата: 2026-09-10
Версия проекта: 35.6.1

## Цель

Провести крупный функциональный исследовательский проход по уже существующим системам consciousness/awareness без создания второго policy-owner. Основные направления:

- global workspace / broadcast;
- recurrent access;
- higher-order metacognition;
- self-perspective / ownership / agency binding;
- temporal continuity across restart and wall-clock gaps;
- lesion / rescue perturbation;
- longitudinal evidence integrity;
- replay/duplicate resistance;
- broad function verification and release regression.

Сознание в проекте не объявляется доказанным. Все соответствующие показатели являются функциональными исследовательскими прокси.

## Реальные изменения

### P31FunctionalConsciousness

Состояние поднято до version=3 и теперь сохраняет:

- `lastWallAt` — последнюю реальную wall-clock точку;
- `recentMomentIds` — последние 64 момента;
- `lesionState` — baseline для контролируемого lesion/rescue.

Время между сохранённым моментом и новым запуском теперь может реально проявляться как `gapMs` и увеличивать `discontinuities`, вместо того чтобы после restart всегда начинаться с нового in-memory clock.

`durationMs` продолжает накапливаться как состояние жизненного цикла, а не как время существования конкретного экземпляра объекта.

Добавлен `rescueLastLesion()` для обратимого perturbation test.

### ConsciousnessEvidenceLedger

Состояние поднято до version=4.

Раньше replay старого `observationKey` мог быть повторно принят после появления других событий, потому что проверялся только последний ключ. Теперь хранится bounded history из последних 128 observation keys.

Это закрывает класс:

`event A → events B...N → replay A`

и не позволяет выдавать replay как новую longitudinal observation.

### OrganismCore

`observationKey` для реального external evidence теперь включает уникальный `decisionForResilience.id`. Поэтому два разных реальных события с одинаковым текстом не схлопываются в одну observation, но настоящий replay идентичного события может быть отфильтрован.

## Настоящая consciousness battery

PASS:

- high-salience workspace меняет focus/access bias;
- high vs low access даёт различный functional broadcast behaviour;
- higher-order метакогнитивная calibration различает well-calibrated и badly-calibrated confidence;
- lesion снижает composite functional measure;
- rescue возвращает точные baseline metrics;
- сохранённые recent moments переживают restore;
- synthetic 20-minute restart gap создаёт discontinuity;
- old observation replay не создаёт новую evidence-support observation;
- независимые observations действительно увеличивают longitudinal evidence.

Результат:

`ignition01 = 0.479`
`functionalIntegration01 = 0.691`
`lesionDelta = -0.106`
`restart gap = 1,200,000 ms`
`discontinuities = 1`

Для metacognition:

`accurate calibration = 0.590`
`inaccurate calibration = 0.446`

Для evidence negative control:

`same key repeated = 1 observation`
`25 independent keys = 25 observations`
`old key replay after intervening events = still 28, not 29`

## Core-level proof

Отдельный Core test прошёл:

- два одинаковых по содержанию external events получили два разных moments;
- evidence support стал `2`;
- recent moments сохраняются и восстанавливаются через persisted Core state.

## Regression

Новый orchestrator `npm run test:big-pass-179:regression`:

**15/15 PASS**

Он покрывает BIG PASS 169–179.

Дополнительно повторно прошли P24/P26/P28/P29/P30/P31/P32/P33/P34/P35/P37/P41/P42/P43/P44/P20.

## Function Reality

Semantic inventory:

**2493 function-like declarations**

| Статус | Count |
|---|---:|
| VERIFIED | 38 |
| INTEGRATION_ONLY | 590 |
| UNSAFE_TO_AUTO_RUN | 224 |
| UNVERIFIED | 1641 |

Strict VERIFIED rate:

**1.52%**

Evidence coverage:

**7.44%**

Critical UNVERIFIED:

**1076**

UNVERIFIED без статических ссылок:

**157**

Safe parameterized probe:

**497/509 PASS**
**0 FAIL**
**0 INPUT_SYNTHESIS_NEEDED**
**12 lifecycle-needed**

Liveness inventory:

- 2568 declarations;
- 2539 with body;
- 107 exported;
- 156 zero-reference;
- 480 one-or-less-reference.

Наличие декларации, export или имени теста не переводит функцию в VERIFIED.

## Release evidence

- Typecheck: PASS
- Architecture: PASS
- Integrity: PASS
- Forensics: PASS
- Hygiene: PASS
- Release source: PASS
- Lock: PASS
- Brain audit: PASS
- Release contract: PASS
- Public utilities: PASS
- Smoke: PASS
- Restart: PASS
- Memory dedupe: PASS
- Concurrency: PASS

## Ограничения

1. Физический Poco M7 Pro 5G напрямую из sandbox не подключался; Android production gate остаётся незавершённым.
2. Heap growth на длинной жизни остаётся отдельным performance debt.
3. Consciousness остаётся функциональным исследованием, не доказательством феноменального опыта.
4. Авторитетным доказательством считаются отдельно завершённые subprocess-gates; огромный transport batch не используется для искусственного PASS/FAIL.

## Первый анализ — повторная проверка

| Домен | Статус |
|---|---|
| Cognitive Event Fabric | DONE |
| Unified Cognitive Cycle | DONE |
| Memory Economy | DONE |
| Emotion / Feeling | PARTIAL |
| Reality vs Simulation | DONE (functional) |
| World Model | PARTIAL |
| Self / Identity | PARTIAL |
| Agency | PARTIAL |
| Learning | PARTIAL |
| Social Mind | PARTIAL |
| Perception | PARTIAL |
| Embodiment | PARTIAL |
| Consciousness research | PARTIAL / research-only |
| Long-horizon life | PARTIAL |
| Adversarial testing | PARTIAL → strong compound baseline |
| Android production runtime | NOT DONE |

## Следующие большие проходы

### BIG PASS 180 — Research/Release Freeze

Единый reproducibility matrix для consciousness, adversarial, longitudinal, persistence и Android.

### BIG PASS 181 — Function Reality Closure 2.0

Массовый lifecycle verification backlog с приоритетом Memory → Self → World → Learning → Agency.

### BIG PASS 182 — Heap / Memory Thermodynamics

500 / 1k / 10k / 50k cycles, retained references, GC, snapshot size, event growth и memory pruning.

### BIG PASS 183 — Social Mind Causal Loop

Другой агент → prediction → relationship memory → emotion → policy → outcome → learning.

### BIG PASS 184 — Scientific Autonomy

Hypothesis → experiment → observation → evidence → replication → revision → value/identity effect.

### BIG PASS 185–187 — Real Longitudinal Life

7 → 30 → 90 days wall-clock evidence.

## Итог

BIG PASS 179 не добавляет искусственный «consciousness score». Он сделал три вещи, которые существенно важнее:

1. временная непрерывность P31 стала действительно persistable;
2. evidence ledger стал защищён от replay inflation;
3. consciousness-related функции получили реальные direct/regression/persistence доказательства и вошли в function reality ledger.
