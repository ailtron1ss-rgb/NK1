# B271 — Neural Autobiographical Core / Архитектура

B271 — это следующий слой после B270 Neural Germinal Organism. Его задача — перенести непрерывность личного опыта из преимущественно символических/внешних memory-ledger механизмов внутрь обучаемой нейронной ассоциативной структуры.

## Основной контур

`B269 spikes`
`→ B270 germinal self/traits`
`→ B271 assembly sequence`
`→ dendritic context prediction`
`→ next-assembly prediction`
`→ sequence binding / replay`
`→ autobiographical continuity`
`→ self-prediction`
`→ endogenous goal proposal`
`→ action bias`
`→ real outcome`
`→ local plasticity`
`→ personality evidence`

## Что считается нейронной частью

B271 хранит числовые assembly traces, transition weights, dendritic context weights, context-to-assembly weights и self encoder. Replay меняет transition weights, а recall работает непосредственно через эти learned weights.

`sequenceMemory` внутри B271 используется для обучения/replay и диагностики, но отдельный тест специально удаляет его после обучения и проверяет recall только по сохранённым learned weights.

## Dendritic context

Следующее assembly зависит не только от предыдущей assembly, но и от:
- текущего context/vector;
- self-latent;
- identity continuity;
- prediction error;
- novelty/uncertainty.

Это позволяет одной и той же assembly sequence иметь разные predictions при изменении внутреннего контекста.

## Autobiographical continuity

Это вычислительный proxy, а не доказательство автобиографического сознания. Он объединяет reconstruction quality, self-prediction, identity continuity и temporal continuity.

## Endogenous goals

B271 создаёт внутреннюю goal proposal из текущих novelty/uncertainty/continuity/traits/goal-pressure. Эти goals пока имеют контролируемый семантический словарь из восьми классов. Это сознательное ограничение безопасности и доказательности, но оно также является главным ограничением автономности следующего поколения.

## Personality coupling

B271 не переписывает personality напрямую. Его goal pressure / reconstruction / self-prediction создают дополнительное causal evidence через существующий `MultiHypothesisPersonality`.

## Self / autonomy coupling

B271 получает self-latent B270 и continuity P80, а предложенное B271 действие получает bounded bias в существующей arbitration pipeline. Это предотвращает захват всей policy одним новым модулем.

## Ключевой научный тест

После обучения sequence pattern:
1. сохранить learned neural weights;
2. удалить `sequenceMemory`;
3. восстановить сеть;
4. дать только начальный assembly cue;
5. реконструировать следующий assembly sequence;
6. сравнить с baseline.

B271 проходит этот тест: recall similarity на первом переходе **0.5338**, и после удаления внутреннего sequence ledger остаётся **0.5338**.

Это доказывает наличие learned associative recall внутри B271, но не доказывает, что система сформировала полноценную человеческую эпизодическую память.
