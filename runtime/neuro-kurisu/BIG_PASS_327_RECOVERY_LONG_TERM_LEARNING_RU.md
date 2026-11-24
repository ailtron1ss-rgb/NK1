# BIG PASS B327 — Recovery-driven Long-Term Learning

Дата: 2026-09-14
База: Neuro-Kurisu 35.6.1 B326

## Цель

Превратить краткоживущий recovery-bias B326 в долговременно обучаемую стратегию. Recovery не должен оставаться только текущим состоянием self-model: независимо подтверждённый опыт восстановления должен становиться частью канонической AdaptivePolicyEngine и влиять на последующее поведение.

## Что реализовано

### 1. Canonical recovery strategy state

В `AdaptivePolicyState` добавлен `recoveryStrategy` с:
- recovery episodes;
- bootId для независимости эпизодов;
- contextKey/action/reward/evidence;
- признаком independent/autonomous evidence;
- promotions;
- числом эпизодов/продвижений;
- сохранением в существующем adaptive-policy state.

Отдельное конкурирующее хранилище памяти стратегии не создано.

### 2. Evidence-gated promotion

Один runtime boot может породить максимум один recovery-learning episode.

Promotion выполняется только при наличии:
- минимум 3 независимых boot IDs;
- минимум 3 согласованных verified recovery outcomes;
- одного действия;
- одинакового направления полезности;
- контекстной близости до одного bucket-изменения.

Таким образом единичный сбой не превращается немедленно в постоянное правило.

### 3. Context transfer

Продвинутая стратегия имеет:
- полный эффект в обученном контексте;
- ограниченный перенос в близкий контекст;
- нулевой перенос в контексты дальше двух признаков расстояния.

### 4. Реальное подключение к OrganismCore

B327 strategy bias добавлен в основной `rawUtility` выбора действия и в canonical policy signal.

Это важно: без этой интеграции сохранённая стратегия была бы только диагностикой, а не частью поведения организма.

### 5. Persistence / migration

Состояние recovery strategy нормализуется при restore/migration и переживает настоящий persistence cycle.

## Проверки

### B327 micro/learning gate — PASS

Три независимых boot IDs создают устойчивую стратегию.

Полученные значения:
- trained-context bias: `+0.0513`;
- related-context transfer: `+0.03078`;
- unrelated-context transfer: `0`;
- restored bias: `+0.0513`.

### B327 Core integration — PASS

Настоящий `OrganismRuntime` был запущен через последовательность из нескольких runtime boot-ов с общей durable state.

Наблюдалось:
- 3 recovery-learning episodes;
- 3 разных boot IDs;
- independent evidence=true для всех трёх verified outcomes;
- promotion=1;
- strategy видна через `OrganismCore.recoveryStrategyDiagnostics()`.

### B326 regression — PASS

Предыдущий recovery-causal-influence gate продолжает проходить без регрессии.

### Migration — PASS

Старый adaptive-policy state без B327-поля корректно мигрирует.

### Global TypeScript check — PASS

`npm run typecheck` → `TYPECHECK=PASS mode=tsc`.

## Обнаруженный и исправленный дефект

Первоначальная Core-интеграция B327 не продвигала стратегию, потому что требовала точного совпадения всех шести context buckets. Реальный организм закономерно менял отдельный bucket между recovery boot-ами.

Вместо ослабления теста была изменена модель консолидации: близкие контексты (distance <= 1) теперь образуют evidence cohort. Это одновременно позволило сохранить generalization и не смешивать далёкие ситуации.

После этого Core gate прошёл.

## Что B327 действительно доказывает

B327 доказывает инженерный механизм долговременного recovery-driven policy learning, а не сознание.

Доказано:
`verified recovery evidence → durable episode → multi-episode consolidation → bounded context transfer → persistent policy influence`.

Не доказано:
- наличие субъективного опыта;
- сознание;
- человеческий уровень автономности;
- универсальное causal/world understanding.

## Ограничения

1. Независимость в B327 пока операционализирована через verified world-transition evidence и различающиеся runtime boot IDs.
2. Promotion пока использует контекстную bucket-схему, а не полноценное learned latent representation.
3. Число recovery episodes для promotion намеренно мало для инженерного gate; это не статистическое доказательство общего закона обучения.
4. Реальный Android/ARM64 device gate ещё не закрыт этим тестом.

## Следующий этап

### B328 — Long-Horizon Causal Learning & Autonomous Strategy Transfer

Следующий шаг должен проверить уже не только recovery, а общий принцип:

`experience → causal attribution → strategy consolidation → novel-context behavior → delayed outcome → second-order learning`

С обязательными control/holdout сценариями, lesion tests и проверкой, что стратегия может быть заменена новой, если дальнейший опыт её опровергает.
