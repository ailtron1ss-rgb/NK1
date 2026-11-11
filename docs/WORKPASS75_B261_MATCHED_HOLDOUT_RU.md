# WorkPass75 — корректный matched holdout для B261

## Обнаруженная ошибка

В B261 поле holdoutBefore01 инициализировалось константой 0.5 и не вычислялось на baseline-модели. Поэтому holdoutDelta01 = 0.5 - candidateError не являлся измеренным улучшением. Сравнение online/replay ошибок в тесте было отдельным числовым сравнением, но сохранённый диагностический delta создавал ложную интерпретацию.

## Исправление

- holdout(samples, baselineSnapshot) сравнивает один и тот же набор наблюдений на замороженном baseline snapshot и текущем кандидате.
- Без baseline snapshot возвращается baselineAvailable=false, delta01=null; promotion/transfer gain не обновляется.
- Baseline snapshot проверяется по версии и размерности.
- Evaluation не вызывает обучение и не мутирует веса; predictTransition остаётся чистым путём оценки.
- Restore старых snapshots без нового флага baseline восстанавливает holdout delta как недоступный, а не доверяет старому числу.
- Добавлены assertions: pre-replay error совпадает с baseline ошибки после replay, delta равен реальной разнице, отсутствие baseline не создаёт uplift.

## Связь с исследованием

MCCL (arXiv:2610.29357, 21 октября 2026) требует matched stateful-vs-reset comparison для оценки вклада накопленного состояния. Этот patch переносит только корректную схему сравнения в B261. Он не доказывает continual learning и не заменяет immutable external holdout, interference/delay sweep или multi-seed CI.

## Границы

Изменяется только экспериментальная оценка B261 и её regression test. Не меняются OrganismBus, production planner, B262, MemoryOS2, пользовательские данные или Release ZIP.
