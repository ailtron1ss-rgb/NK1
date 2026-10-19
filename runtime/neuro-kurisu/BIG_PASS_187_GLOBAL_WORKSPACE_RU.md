# NEURO-KURISU — BIG PASS 187 — RECURRENT GLOBAL WORKSPACE 2.0

## Цель

Сделать следующий уровень центрального мозга: не новый coordinator, а реальный recurrent workspace substrate, который получает конкурирующие представления, формирует ограниченную coalition, поддерживает временную динамику и предоставляет глобальный broadcast другим подсистемам.

## Что внедрено

Добавлен `GlobalWorkspaceSubstrateV2`. Он реализует:

- bounded competitive selection;
- learned salience gate;
- recurrent latent state;
- selective coalition до 5 элементов;
- global broadcast vector;
- reward-dependent gate learning;
- persistent snapshot/restore;
- independent lesions: recurrence, broadcast, competition;
- diagnostics без claims о сознании.

## Интеграция

CentralBrain теперь принимает broadcast предыдущего workspace как `actionContext`; workspace получает текущее состояние CentralBrain как часть контекста и features. Это создаёт реальную межцикловую causal loop:

`CentralBrain(t) → Workspace(t) → broadcast(t) → CentralBrain(t+1)`

Кроме того, live outcome передаётся workspace в reward-learning path. New workspace остаётся evidence-gated и не имеет права ухудшать существующую action policy только за счёт своего существования.

## Проверка

- Typecheck: PASS
- BIG PASS 183 CentralBrain regression: PASS
- BIG PASS 185 Hippocampal regression: PASS
- BIG PASS 186 Predictive Self/Agency regression: PASS
- BIG PASS 187 Workspace: PASS
- Brain audit: PASS
- Architecture audit: PASS
- Forensics audit: PASS
- Source hygiene: PASS
- Release source: PASS

Full-project audit возвращает `ok=true`; текущие предупреждения относятся к старым generated semantic-audit JSON и Live2D vendor assets, а не к новому brain code.

## Сильное доказательство

Standalone 80-cycle run показал устойчивый recurrent latent, ненулевой broadcast, bounded coalition и reward learning. Отдельный lesion battery демонстрирует изменение output при отключении recurrence и broadcast.

## Что не заявляется

Наличие recurrent workspace не доказывает phenomenal consciousness. Это computational mechanism, совместимый с одной из влиятельных исследовательских линий, но современное экспериментальное сравнение GNWT и IIT показало, что ключевые предсказания обеих теорий получают одновременно поддержку и серьёзные вызовы. Следовательно, workspace используется как research substrate, а не как «доказатель сознания».

## Следующий шаг

B8/B9 после B6/B7: neuromodulatory control и predictive interoceptive/allostatic coupling должны стать частью same latent dynamics. После этого нужен brain-wide ablation matrix, где удаление каждого центрального механизма проверяет его причинный вклад.
