# Глубокий аудит B309 — Canonical Arbitration Consolidation
Дата: 13.09.2026

## 1. Почему B309 вообще нужен
B308 доказал, что `AdaptivePolicyEngine` умеет менять effective policy ranking, однако в полном `OrganismCore` выбранное действие в smoke-run не изменялось: множество других action-bias ветвей перекрывало policy signal. Одновременно аудит кода показал, что исполнительный fusion B297 собирал много похожих сигналов как независимые источники, а adaptive policy существовал ещё и внутри ранней utility-фазы.

B309 поэтому не создаёт новый learner. Он переносит policy learning в канонический исполнительный fusion B297 и добавляет в сам fusion динамическое подавление повторяющихся источников.

## 2. Что изменено в ядре
### 2.1 Policy стал первым классом source
`AdaptivePolicyEngine` теперь отдаёт свой signed trusted signal + temporal credit как `policy` source в `B297ExecutiveNeuralFusion`.

Раннее прямое `+ adaptiveBias` из utility удалено: сигнал не должен одновременно считаться ранней utility-прибавкой и полноценным executive source. Это устраняет один класс двойного учёта.

### 2.2 Redundancy-aware fusion
B297 теперь для каждой пары источников поддерживает moving redundancy estimate. Если несколько источников долго дают одинаковый сигнал, их effective weight уменьшается, но не падает ниже bounded floor.

Это не выбрасывает источник. Это снижает вероятность, что пять почти одинаковых ветвей будут ошибочно выглядеть как пять независимых доказательств.

### 2.3 Диагностика консолидации
Добавлены:
- `consolidationEvents`
- `lastEffectiveWeights`
- `lastDeduplicatedContribution01`
- `sourceConsolidation01`
- `sourceCount`

## 3. Реальное evidence
### 3.1 Executive policy lesion
В unit-тесте policy-only signal переводит executive selection в `explore`. Отдельный engine с lesion `policy` возвращает выбор к baseline `respond`.

Это доказательство, что policy signal теперь действительно входит в decision arbitration, а не просто существует рядом.

### 3.2 Дублирующиеся источники
После 90 повторных fusion cycles на одном и том же redundant pattern:
- найдено несколько повторяющихся пар источников;
- максимальные measured pair redundancy ≈ `0.3268`;
- `consolidationEvents=98`;
- `lastDeduplicatedContribution01≈0.01979`;
- `sourceConsolidation01≈0.39761`;
- effective policy weight ≈ `0.68329` до lesion;
- после policy lesion effective policy weight = `0`.

### 3.3 Live OrganismCore
В отдельном live core тесте:
- 16 full cognitive cycles;
- B309 policy source присутствует в B297 fusion;
- policy source weight ≈ `0.72` в текущем snapshot;
- state сохраняет `lastSignals.policy`;
- restore проходит.

Важное ограничение: этот smoke-run не является доказательством того, что полный организм уже обязан менять итоговое распределение действий. Слишком много остальных arbitration-ветвей остаётся активным.

## 4. Migration
Schema остаётся `127`.
Старые B297 states без B309 fields получают безопасные defaults уже в `StateMigrations`, а не только в runtime restore.

Migration evidence:
- `cycles=11` сохранены;
- `consolidationEvents=0` default;
- `sourceConsolidation01=0` default.

## 5. Нейронная реальность
B309 не заменяет B296/B269.
Контрольный B298:
- 36 learning updates;
- 5616 synaptic updates;
- 71 learned transitions;
- 3 dreams;
- lesion effect;
- restore learningUpdates=36.

## 6. Что B309 действительно доказывает
1. Policy signal теперь является частью executive arbitration.
2. Его можно причинно отключить lesion-проверкой.
3. Повторяющиеся source signals измеряются и получают уменьшенный effective weight.
4. Старые saved states мигрируют в новый формат.

## 7. Что B309 НЕ доказывает
- полноценную open-ended автономию;
- сознание;
- человеческое semantic understanding;
- physical Android performance;
- P7 independent replication;
- автоматическое изменение whole-organism action distribution после одного policy learner.

## 8. Ключевой следующий вопрос
Следующий этап должен измерить не только `policy ranking`, но и `final action distribution` после серии verified outcomes. При этом нужно сначала посмотреть, какие remaining sources реально подавляют policy signal; нельзя просто умножать policy coefficient вслепую.
