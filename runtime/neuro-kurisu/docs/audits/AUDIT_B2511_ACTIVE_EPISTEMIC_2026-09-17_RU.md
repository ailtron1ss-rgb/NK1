# Forensic Audit — B2511 Active Epistemic Experimentation

Дата: 2026-09-17
Релиз: 35.6.53
Core: 79.6.0-active-epistemic-experiment-b2511
Schema: 172

## Проверяемые утверждения

1. B2511 реально вызывается из полного decision path.
2. Его состояние persist/restore.
3. После outcome выполняется learning update.
4. Lesion изменяет causal signal.
5. Вклад ограничен bounded bias и не заменяет executive policy целиком.
6. ActivePerceptionNeural обучается по тому же hidden representation, который породил prediction.

## Верификация

- typecheck: PASS
- direct B2511: PASS
- runtime B2511: PASS
- mobile B2511: PASS
- architecture: PASS
- core ownership: PASS
- forensics: PASS
- source hygiene: PASS
- integrity: PASS
- release contract: PASS
- release source: PASS

## Содержательный causal holdout

Baseline reward = 774.0.
B2511 reward = 1116.8.
Relative gain = 44.289%.
Correct baseline = 600/1200.
Correct B2511 = 1180/1200.

Этот результат относится только к synthetic hidden-rule environment и не должен трактоваться как доказательство сознания, общей автономности или эквивалентности биологическому мозгу.

## Найденная и исправленная проблема

`ActivePerceptionNeuralSubstrate.rank()` до релиза B2511 восстанавливал старый recurrent hidden state перед возвратом. Это разрыв causal credit assignment: prediction вычислялся на `h`, а последующее обучение могло использовать предыдущий `hidden`.

Исправление: `rank()` теперь сохраняет `h` как текущую обучаемую representation.

## Остаточные риски

- Реальный Android thermals/power пока проверены только host-side.
- Информация и uncertainty по-прежнему частично синтетические.
- B2511 улучшает выбор исследования, но не является полноценным Bayesian model-selection engine.
- Феноменальное сознание не измеряется и не заявляется.
