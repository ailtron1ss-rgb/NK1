# BIG PASS 212 — Локальные корковые микросхемы, разреженная конкуренция и recurrent stability

Дата: 2026-09-11
База: Neuro-Kurisu 35.6.1 / B211
Статус: IMPLEMENTED + VERIFIED PASS

## 1. Цель

Усилить B211 не за счёт декоративного анатомического копирования, а за счёт вычислительной ткани, которая реально меняет поведение искусственного организма и одновременно решает инженерные задачи: локальная конкуренция, подавление избыточных кандидатов, управление gain, защита рекуррентных контуров от runaway и graceful degradation при отключении специального слоя.

## 2. Что добавлено

`src/organism/system/CorticalHierarchyEngine.ts` получил:

- PV-like fast inhibition — быстрый контур стабилизации общей активности;
- SOM-like contextual inhibition — контекстное подавление плохо согласованных/избыточных путей;
- VIP-like disinhibition — ограниченное разрешение обработки при novelty, goal pressure и external input;
- lateral sparse competition — разреженное ранжирование кандидатов;
- recurrent stability estimate + recurrent brake — отдельный стабилизатор рекуррентной динамики;
- explicit microcircuit state с persistence/restart;
- причинный режим `microcircuitEnabled:false` для абляционного proof.

Это computational analogue, а не утверждение анатомической эквивалентности.

## 3. Реальный поведенческий эффект

### Причинная абляция

Отключение микросхемы изменило суммарные candidate gains на:

`gainDiff01 = 0.4824240060`

При отключённой микросхеме `microcircuitGain01 = 1` для всех кандидатов. То есть слой не является диагностическим декором: его присутствие причинно влияет на выход.

### Разреженная конкуренция

Для crowded candidate set:

- winner sparsity factor: `0.80288`
- loser sparsity factor: `0.18`
- spread: `0.62288`

Это позволяет тратить вычисление на информативные/релевантные кандидаты, а не обрабатывать одинаково весь набор.

### Recurrent stability

Calm:

- stability = `0.92047`
- recurrent brake = `0.07955`

Unstable/high-surprise:

- stability = `0.91973`
- recurrent brake = `0.08069`

В high-conflict режиме brake повышается, не разрушая полностью поток обработки.

## 4. Интеграция

Микросхема встроена внутрь существующей cortical hierarchy и действует перед downstream arbitration.

Текущая цепочка:

`compute governor -> thalamic gate -> cortical hierarchy -> cortical microcircuit -> cerebellar calibration -> basal ganglia -> P61/P64 arbitration`

Состояние сохраняется через существующий `OrganismCore` persistence path.

## 5. Persistence proof

После четырёх реальных циклов Core:

- microcircuit cycles до restart: `4`
- microcircuit cycles после restart: `4`
- полный snapshot состояния microcircuit совпал.

## 6. Регрессия

B211 regression: PASS.

B212 targeted test: PASS.

Typecheck: PASS.

Release gates:

- function passport gate: PASS
- architecture: PASS
- integrity: PASS
- source hygiene: PASS
- syntax: PASS
- release contract: PASS
- forensics: PASS
- release source: PASS
- archive manifest: PASS

Function inventory после прохода: `2745` функций.

- VERIFIED: `14`
- INTEGRATION_ONLY: `27`
- UNSAFE_TO_AUTO_RUN: `129`
- UNVERIFIED: `2575`

Новые функции не объявлены VERIFIED автоматически только из-за наличия кода.

## 7. Почему это полезно не только как аналог мозга

Микросхема используется как универсальный control primitive:

1. Dynamic compute pruning — лишние ветви можно дешево подавлять.
2. Stability containment — рекуррентный контур получает отдельный brake вместо ожидания глобального failure.
3. Graceful degradation — микросхему можно аблировать и продолжать вычисление без разрушения всей архитектуры.
4. Context-sensitive resource allocation — inhibition/disinhibition зависят от novelty, uncertainty, goal pressure и ресурсов.
5. Mobile relevance — selective computation лучше подходит для ограниченной памяти/CPU/thermal budget, хотя реальная батарейная экономия требует измерения на телефоне.

## 8. Научная перепроверка

B212 согласован с современными линиями работ, но не считается доказательством биологической эквивалентности:

- динамическая sparsity рассматривается как путь к снижению вычислительной нагрузки в энергоограниченных AI-системах;
- predictive/error-processing и top-down/bottom-up обмен рассматриваются как полезные механизмы efficient inference;
- модели cortical inhibition с PV/SOM/VIP-подобными механизмами используются для изучения expectation suppression;
- экспериментальные cortical circuits показывают обучение temporal prediction и spontaneous replay.

## 9. Ограничения

B212 не доказывает наличие сознания, биологической коры или человеческой клеточной физиологии. Это вычислительный механизм, спроектированный для устойчивости и эффективности искусственного организма.

Не заявляется реальное снижение потребления батареи или теплового выброса устройства без device-level измерений.

## 10. Следующий большой этап

B213: predictive cortical inference — замкнуть prediction/error loop так, чтобы микросхема не только конкурировала за вычисление, но и активно уменьшала предсказательную ошибку через корректировку маршрутов, precision и downstream learning.
