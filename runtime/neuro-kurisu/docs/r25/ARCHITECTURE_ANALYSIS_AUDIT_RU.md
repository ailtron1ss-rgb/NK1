# Аудит внешнего архитектурного анализа NeuroCore v128 — R25

Дата: 2026-09-30
База: Neuro-Kurisu 35.38.0 R24

## 1. Что подтверждено анализом и действительно полезно

Внешний текст предлагает четыре направления, которые хорошо ложатся на текущую архитектуру Neuro-Kurisu:

1. curvature-aware / preconditioned delta update — полезно как лёгкая диагональная аппроксимация, особенно для коррелированных признаков;
2. раздельные erase/write gates — полезно для памяти и пластичности, чтобы сила удаления старой информации не была жёстко связана с силой записи новой;
3. многошкальная временная память / HiPPO-подобное представление — полезно как направление для долгого кредитного следа;
4. гибрид последовательного состояния и разреженного/селективного маршрута — полезен концептуально, но требует осторожной адаптации под CPU/Termux.

## 2. Что не было принято буквально

### Mamba-3 / SSD
Текст описывает замену текущего ствола настоящим Mamba-3 MIMO/SSD. В текущем проекте такой перенос как "прямая замена" был бы недостоверен: предоставленный текстовый пример не является полной официальной реализацией Mamba-3/SSD и не содержит полноценного chunk-scan / межблочного state transfer.

R25 поэтому не подменяет canonical neural path псевдо-Mamba реализацией. Вместо этого сохранена существующая bounded recurrent ветка как отдельная абляция.

### Triton/CUDA
GPU-операторы не интегрированы в canonical runtime: проект ориентирован на Termux/средний Android, а наличие Triton/CUDA не является данностью среды.

### MEMO
Внешний CLI не помещён в обязательный runtime path. Для текущего организма это было бы внешней зависимостью без гарантии воспроизводимости на целевом устройстве.

### MoBA / Context Parallelism
Оставлены как исследовательские направления. Текущий TS-runtime не содержит полноценного distributed ring communication и поэтому не маркирует его как реализованный механизм.

## 3. Реальные проблемы найденного исходного примера

Проверка исходного текста выявила несколько мест, которые нельзя переносить как готовую реализацию:

- `mamba3_candidate.py` заявляет SSD/MIMO, но приведённая реализация фактически содержит линейные проекции, depthwise convolution и упрощённый state update; полноценный Mamba-3 SSD не реализован.
- `solve_tril_wy_representation()` не даёт обещанной формулы "O(d)": размер треугольной системы определяется длиной chunk/последовательности, а не сводится автоматически к линейному времени по размерности.
- `OnlinePlasticityEngine` содержит Oja-подобный decay, но приведённая операция зависит от конкретных размерностей `T` и `d_state`; её нельзя считать проверенным универсальным оператором без отдельной валидации.
- `UnifiedSparseMemory` — параметризованная память с `topk` retrieval, но приведённый код не показывает реального онлайн-записывания/редактирования содержимого memory slots.
- `DPLRGradientArbitrator` использует явное `inv(U^T U + eps I)`, поэтому заявление о бесплатной низкоранговой ортогонализации не подтверждается этим фрагментом.
- `ContextParallelRing.split_sequence()` возвращает только первый chunk и не реализует ring communication.
- `FusedLinearCrossEntropyLoss` в примере не является fused kernel и KL-терм не реализован.
- численные обещания вроде `3.2x`, `6.5x`, `65%`, `70%`, `40–45%` не приняты как результаты Neuro-Kurisu без отдельного matched benchmark.

## 4. Что реально интегрировано в R25

### 4.1 Curvature-aware delta
Добавлен `src/organism/system/NeuroCoreAdaptiveOperators.ts`.

Это CPU/Termux-safe диагональный running-curvature operator. Он не выдаётся за полноценный GPU KKT/WY оператор.

Интеграция выполнена в canonical `B365UnifiedNeuroCausalCore` и используется для обновления action readout во время verified learning.

### 4.2 Dual erase/write gating
В том же операторе введены независимые erase/write gates.

- erase зависит от surprise, uncertainty, stability и verification;
- write зависит от novelty, verification, stability и uncertainty;
- старый readout слегка затухает независимо от силы нового update.

Это переводит идею Gated DeltaNet-2 в безопасную CPU-форму без заявления об эквивалентности оригинальному оператору.

### 4.3 Sequence world-model head
`B262MultiTimescaleWorldModel` получил отдельные sequence heads для горизонтов 5–8.

Обучение идёт из реальных последовательностей последних 8 эпизодов во время replay, поэтому это не отдельный disconnected benchmark-only модуль.

### 4.4 Hierarchical 4+4 planning
Добавлен `planHierarchical()`:

- первый уровень строит 4-шаговую coarse trajectory;
- второй уровень продолжает лучшие coarse branches ещё на 4 шага;
- итоговый план имеет горизонт 8;
- сохраняется сравнение с greedy baseline.

В `OrganismCore` этот путь активируется периодически (`tick % 64 === 0`), а не на каждом тике, чтобы не перегружать мобильный runtime.

## 5. Первичная R25 проверка

- adaptive operator: 96/96 updates, finite diagnostics;
- B365 canonical learning: 576 operator updates;
- B365 restore: operator state restored exactly;
- legacy B365 state without the new field: backward-compatible restore PASS;
- B262 sequence updates: 720;
- held-out sequence error: `0.01517` vs untrained baseline `0.01791`, improvement `0.00274`;
- hierarchical plan: depth 8 with 4+4 refinement.

Эти числа являются внутренним engineering benchmark, а не доказательством общих когнитивных свойств.
