# NK1 — причинная интеграция аффекта, мотивации и эндогенных целей

**Дата:** 1 ноября 2026  
**База:** `workpass70-source` на `795bb672fd3af0a5ec85cc7d783d00a9226fe083`  
**Рабочая ветка:** `work/nk1-affect-causal-port-20261101`  
**Состояние:** реализация перенесена выборочно; точный результат определяется CI этого PR. Release ZIP и `main` не изменялись.

## Что реально изменено

1. **EmotionAppraisalEngine** — перенесены устойчивое медленно затухающее настроение, смешанный аффект, confidence-gated appraisal-модуляторы и контекстная калибровка исходов с ограниченным idempotency ledger. Входы проходят через plain-data snapshot boundary.
2. **IntrinsicMotivationEngine** — каноническое эмоциональное состояние преобразуется в четыре ограниченных влияния: exploration, regulation, engagement и connection. Эмоциональное состояние не дублируется внутри мотивации: сохраняется только происхождение и проекция.
3. **OrganismCore** — appraisal из текущего цикла передаётся в мотивацию до генерации цели. При feedback исход привязывается к эмоции, которая влияла на решение, а не к новой пост-результатной эмоции. Для повторов используется trace-derived receipt.
4. **B272EndogenousGoalGenesis** — шестиканальный профиль драйвов входит в существующий goal vector с confidence gate. Второй планировщик не создаётся.
5. **P66InteroceptiveHomeostasis** — исправлен порядок hysteresis: итоговый режим фиксируется до счётчиков, истории и persisted state, чтобы возвращаемый режим совпадал с сохранённым.
6. **Проверки** — добавлены runtime causal regression и restore-boundary regression; отдельный Actions workflow запускает typecheck и соседние контракты.

## Почему это важно

Раньше эмоциональный сигнал мог менять action bias, но не был полноценным входом в мотивационные драйвы. Теперь цепочка замкнута архитектурно: appraisal → affective drive projection → B272 goal vector → action trace → feedback receipt → calibration. Сигналы ограничены по диапазону и уверенности; нейтральный путь остаётся совместимым.

## Что ещё не доказано

- CI exact-head должен пройти целиком; локальный запуск в этой среде не заявляется.
- Причинное поведенческое улучшение нужно измерить ablation-экспериментом: одинаковые входы/seed, affect on/off, ≥5 парных holdout seed, отдельно сравнить выбор цели/действия и outcome.
- Нужны RU/EN сценарии, длительный autonomous initiative soak и физический Android/Termux прогон.
- Никаких утверждений о феноменальном сознании или субъективных переживаниях этот код не обосновывает.

## Статус реализации

| Участок | Статус |
|---|---|
| Appraisal → motivation | Реализовано в ветке |
| Motivation → B272 goal vector | Реализовано в ветке |
| Decision-time emotion → outcome receipt | Реализовано в ветке |
| P66 hysteresis consistency | Исправлено в ветке |
| Restore boundary + causal regression | Добавлено, ждёт CI |
| Independent behavioral uplift | Не измерен |
| Release ZIP / main | Не затронуты |
