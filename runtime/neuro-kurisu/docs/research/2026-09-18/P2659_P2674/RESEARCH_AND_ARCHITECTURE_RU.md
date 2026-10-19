# Neuro-Kurisu P2659–P2674 — исследовательская и архитектурная база

Дата: 18 сентября 2026

## 1. Основное инженерное решение

Вместо дальнейшего размножения независимых cognitive services введены два связующих механизма:

1. **CrossLayerAdaptiveArbiter** — обучаемый маршрутизатор между уже существующими neural/causal/embodied/transfer/hierarchical/task-free/personality/risk/memory/developmental сигналами.
2. **ExternalGroundingAdaptiveController** — отдельный слой качества внешнего сенсорного свидетельства: свежесть, надёжность канала, противоречия, активный запрос дополнительного наблюдения.

Это уменьшает главный архитектурный дефект предыдущего поколения: множество работающих подсистем могли выдавать полезные сигналы, но их объединение было в значительной степени фиксированной ручной суммой.

## 2. Новейшие исследовательские ориентиры

### World-In-World / ICLR 2026
https://proceedings.iclr.cc/paper_files/paper/2026/hash/5b4263be85820683d78675cc18d2efc7-Abstract-Conference.html

Вывод для проекта: оценивать world models в closed-loop, по полезности для действия и успеху задачи, а не по визуальной правдоподобности. Поэтому тесты Neuro-Kurisu должны продолжать связывать prediction → action → observation → outcome.

### Test-Time Mixture of World Models (TMoW), ICLR 2026
https://arxiv.org/abs/2601.22647

Вывод: routing между моделями можно адаптировать во время inference; prototype-based routing и refinement особенно релевантны нашему task-free transfer.

### Modular Memory is the Key to Continual Learning Agents, 2026
https://arxiv.org/abs/2603.01761

Вывод: устойчивое continual learning требует совместного использования быстрого контекстного обучения и более стабильного долговременного обновления. Это поддерживает разделение episodic/autobiographical memory, replay и медленных параметрических/нейронных изменений.

### World models for Physical AI survey, 3 Sep 2026
https://doi.org/10.1007/s44163-026-02122-1

Вывод: ключевые оси проектирования — state abstraction, temporal dynamics, uncertainty, structural priors, observation modality и decision coupling. В нашем проекте особенно недоразвит последний пункт: именно поэтому введён adaptive cross-layer arbiter.

### Active inference and artificial reasoning, Nature Communications, 2026
https://www.nature.com/articles/s41467-026-77209-5

Вывод: действия могут выбиратьcя не только по немедленной ценности, но и по ожидаемому информационному выигрышу — то есть действие может быть экспериментом, уменьшающим неопределённость модели. Следующий кандидат для P2675+ — формализованный information-gain action selector.

### Active Inference World Models, 2026
https://zenodo.org/records/21325216

Вывод: perception, uncertainty, planning, control и goals полезно рассматривать как tightly coupled closed-loop system, а не полностью независимые стадии. Это совпадает с текущей cross-layer интеграцией.

## 3. Что не следует делать

- Не превращать каждый новый paper в отдельный сервис.
- Не считать рост внутренних score доказательством сознания.
- Не считать replay автоматически полезным: конфликтующие/устаревшие эпизоды должны проходить quality/conflict gates.
- Не переносить desktop-scale architectures на medium Android без compute/thermal gating.
- Не считать simulator evidence равным physical Android evidence.

## 4. Экспериментальная гипотеза

Если связать:

`adaptive world-model routing + autobiographical memory + causal credit + recovery + developmental goals + cross-layer arbitration + external evidence quality + active information seeking`

в одну замкнутую систему, потенциальный эффект должен проявляться прежде всего в:

- меньшем количестве плохих transfer decisions;
- более быстрой реакции на distribution shift;
- меньшем количестве необоснованных действий при сенсорной неопределённости;
- более устойчивом long-horizon learning;
- более эффективном использовании compute на mobile;
- лучшей причинной связи между опытом и будущим поведением.

Нельзя честно складывать reported gains разных публикаций: они измерены на разных задачах и не являются независимыми. Поэтому проект должен измерять собственный ablation matrix.

## 5. План следующего эксперимента

A: fixed weighted fusion
B: adaptive arbiter
C: arbiter + external grounding
D: C + information-gain exploration
E: D + long-horizon fault injection
F: полный организм + real Android evidence

Основные метрики: reward, recovery success, transfer utility, calibration, contradiction rate, active-perception gain, retention, holdout generalization, energy/latency и regression rate.
