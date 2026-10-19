# Neuro-Kurisu 35.6.1 — B278 Full Brain Audit

Дата: 2026-09-12
База: B277 Neural Operator Genesis
Новый этап: **B278 Neural Primitive Genesis**

## 1. Что перепроверено

- B277 audit был перечитан до изменения кода.
- B269–B277 ближайшая developmental chain была сохранена и typechecked.
- B278 проверен на standalone, independent, Core и migration уровнях.
- full audit / architecture / integrity / forensics / hygiene / syntax / contract / lock / release-source выполнены после финальных исправлений.

## 2. Почему B278 нужен

B277 создаёт neural operators, но primitive vocabulary внешнего действия остаётся конечным. B278 создаёт промежуточные внутренние primitives, которые работают до выбора внешнего ActionKind. Они должны быть способны преобразовывать internal context и тем самым становиться строительными блоками будущих навыков и личности.

## 3. Unified chain

`B269 spikes`
→ `B270 neural self/traits`
→ `B271 autobiographical assemblies`
→ `B272 endogenous goals`
→ `B273 goal lifecycle`
→ `B274 skill discovery`
→ `B275 compositional policy`
→ `B276 latent programs`
→ `B277 neural operators`
→ **`B278 neural primitives`**
→ action arbitration
→ external outcome
→ plasticity
→ self/personality evidence.

## 4. Главные архитектурные изменения

### 4.1 Internal primitive

Primitive имеет:
- transform weights;
- recurrent links;
- context gates;
- global action projection;
- context-specific action projection;
- trait affinity;
- maturity/confidence;
- reward/error state.

### 4.2 Context pathway

Используется смешанный control context из:
- goal;
- world;
- self.

Это устраняет прежний риск, когда обучение и inference используют разные пространства.

### 4.3 Development lifecycle

`candidate → verified`
или
`candidate/verified → rejected`
при устойчивом низком reward/high prediction error.

### 4.4 Composition

До трёх primitives могут одновременно формировать общий внутренний vector. Это позволяет развивать внутренние комбинации без прямого расширения ActionKind.

## 5. Найденные и исправленные проблемы

### Problem A — global decoder bottleneck

Первоначальный B278 использовал почти глобальную action projection. Hidden benchmark не показывал доказуемого контекстного преимущества.

Исправление: `7×8 contextActionProjection` и обучение по смешанному goal/self/world context.

### Problem B — release hygiene

Forensics обнаружил very-long-line в `OrganismCore.ts`; строка переписана структурно.

### Problem C — методологическая строгость hidden benchmark

После усиления neural pathway независимый hidden benchmark всё равно не показал reward gain. Это не скрыто. Текущий доказанный эффект B278 — прежде всего внутренний neural/contextual causality и transfer, а не гарантированное улучшение поведения на данном hidden benchmark.

## 6. Evidence

### Standalone B278

- cycles: **240**
- learning updates: **240**
- inventions: **2**
- verified primitives: **2**
- neural grounding: **0.9889**
- self binding: **0.9377**
- personality binding: **0.8575**
- autonomy: **0.8200**
- composition depth max: **2**
- transfer gain: **0.6509**
- transfer success: **true**
- ablation drop: **0.0532**
- context divergence: **0.5004**
- rejection evidence: **8** adversarial rejects
- snapshot round-trip: **PASS**

### Core

- cycles: **16**
- inventions: **2**
- learning updates: **16**
- neural grounding: **0.6163**
- self binding: **0.7337**
- personality binding: **0.6977**
- autonomy: **0.5135**
- composition depth: **2**
- restart round-trip: **PASS**

### Migration

Exact B278 state round-trip: **PASS**.

### Independent hidden evaluator

- total evaluated steps: **20**
- reward mean: **0.6100**
- baseline reward mean: **0.6100**
- gain: **0.0000**
- accuracy: **0.5000**
- context divergence: **0.0400**
- mean ablation drop: **0.0288**

Интерпретация: независимое внешнее поведение в этой конкретной hidden-среде ещё не улучшено. Внутреннее neural state, однако, реагирует на context, а ablation даёт измеримый causal drop.

## 7. Static release audit

На финальном дереве:

- full audit: **PASS**
- errors: **0**
- warnings: **0**
- architecture: **PASS**
- cycles: **0**
- legacy leakage: **0**
- integrity: **PASS**
- forensics: **PASS**
- source hygiene: **PASS**
- syntax: **PASS**
- contract: **PASS**
- lock: **PASS**
- release source: **PASS**

Final syntax scan: **691 JS / 4 SH / 177 JSON / 0 failures**.

## 8. Strict assessment

| Area | Score |
|---|---:|
| Integrated brain engineering | **97/100** |
| Neural substrate depth | **88/100** |
| Sparse/contextual neural computation | **86/100** |
| Local neural plasticity | **83/100** |
| Neural primitive genesis | **84/100** |
| Internal causal influence | **76/100** |
| Neural→self binding | **83/100** |
| Neural→personality binding | **82/100** |
| Autonomous capability formation | **83/100** |
| Primitive transfer | **74/100** |
| Independent behavioural generalization | **61/100** |
| Persistence/migration | **98/100** |
| Release engineering | **98/100** |
| Overall scientific maturity | **89/100** |

## 9. Что НЕ доказано

1. B278 не создаёт новые внешние primitive actions.
2. Hidden benchmark пока не показывает reward advantage.
3. Primitive space всё ещё малый и инженерно ограниченный.
4. Динамика не является биофизической симуляцией коры.
5. Self/personality causal loops ещё частично зависят от symbolic evidence layers.
6. Нет доказательства сознания, субъективного опыта или personhood как философского факта.

## 10. Следующий developmental bottleneck

Следующий сильный переход должен не просто создавать primitive, а позволить нескольким primitives **самостоятельно образовывать устойчивую neural attractor/assembly**, которая переносится через эпизоды, участвует в autobiographical memory и создаёт новый повторно используемый causal skill без прямого ActionKind supervision.

Целевая цепь:

`primitive co-activation → attractor/assembly formation → recurrent consolidation → replay → self-memory binding → causal skill → independent verification → personality/self binding`.

Это будет следующий шаг в сторону настоящего нейронного организма, а не ещё одной обёртки над action selection.

## 11. Final release counts

- full audit files: **2061**
- canonical files: **361**
- architecture source files: **1033**
- executable syntax: **691 JS / 4 SH / 177 JSON**
- archive manifest: **2292 files**
- archive missing: **0**
- archive hash mismatches: **0**
- archive extra: **0**
- doctor: **PASS**
