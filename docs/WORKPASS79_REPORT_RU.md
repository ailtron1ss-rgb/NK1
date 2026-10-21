# WorkPass79 — отчёт о модернизации обучения

**Дата:** 2026-10-21  
**Репозиторий:** https://github.com/ailtron1ss-rgb/NK1  
**Ветка:** `workpass79-learning-input-integrity`  
**PR:** https://github.com/ailtron1ss-rgb/NK1/pull/13  
**Статус:** код подготовлен к review; тесты в этой среде не запускались, CI пока не подтвердил результат.

## Что реально изменено

1. **Защита обучения от повреждённых данных.** `ParametricPolicyLearner.train()` теперь отклоняет неизвестные действия и нечисловые значения target, learning rate и sample weight до изменения состояния модели.
2. **Защита прямого обучения по признакам.** `trainFeatures()` отклоняет feature-векторы с NaN/Infinity, предотвращая распространение нечисловых значений в веса.
3. **Новая регрессия.** Добавлен `tests/p26-learning-input-integrity.mjs`: проверяет пять негативных случаев, отсутствие мутации состояния при отказе и сохранение работоспособности корректного обновления.
4. **Подключение теста.** Добавлена команда `test:p26:learning-input-integrity` в runtime `package.json`.
5. **Исследовательский след.** В `docs/RESEARCH_INTAKE_LEDGER.md` добавлена запись AgentMemoryBench: протоколы online learning, transfer, replay/forgetting и repair after incorrect feedback. Код/данные стороннего проекта не копировались.

## Исследовательская основа

- **MemoryAgentBench (ICLR 2026):** оценка accurate retrieval, test-time learning, long-range understanding и conflict resolution. Источник: https://github.com/HUST-AI-HYZ/MemoryAgentBench
- **AgentMemoryBench:** online learning, replay/retention, transfer и восстановление после ошибочной обратной связи. Источник: https://github.com/solomoon313/AgentMemoryBench

Вывод для NeuroCore: оценка обучения должна проверять не только успешное обучение на синтетической выборке, но и реакцию на ошибочную обратную связь, исправление после неё, перенос, обращение задачи и сохранение ранее выученного. Это следующая экспериментальная очередь, не заявленный результат текущего PR.

## Изменённые файлы

- `runtime/neuro-kurisu/src/organism/learning/ParametricPolicyLearner.ts`
- `runtime/neuro-kurisu/tests/p26-learning-input-integrity.mjs`
- `runtime/neuro-kurisu/package.json`
- `docs/RESEARCH_INTAKE_LEDGER.md`
- `docs/WORKPASS79_REPORT_RU.md` (этот отчёт)

## Проверка и ограничения

- Создан PR #13; не слит.
- Проверка CI по head commit пока не вернула workflow runs/statuses.
- Новый тест **не считается пройденным**, пока не будет реально выполнен в GitHub Actions или целевом окружении.
- Не измерялись transfer gain, learning gain, forgetting rate, calibration, скорость, энергопотребление или качество на независимом holdout.
- Не заявляется улучшение общей интеллектуальной эффективности; исправлена только целостность входов обучения.

## Следующий кодовый этап

1. Получить PASS для новой регрессии, typecheck и существующего P26 learning suite.
2. Добавить парные испытания: корректная обратная связь против ошибочной; recovery после исправления; reversal; replay ранее выученных задач; no-learning control.
3. Для каждого эксперимента фиксировать dataset/corpus fingerprints, независимый holdout, метрики до/после, ресурсную стоимость и все неудачные gates. Ничего не продвигать автоматически по результату одного seed.
