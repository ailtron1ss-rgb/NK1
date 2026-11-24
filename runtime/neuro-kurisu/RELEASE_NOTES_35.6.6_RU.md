# Neuro-Kurisu 35.6.6 — B353 Causal SNN Multi-Context + SHAM

## Крупный шаг
Закрыта основная методологическая дыра Кирпича 3: причинность B269 проверяется не по случайным выбранным действиям, а по среднему 7-мерному policy softmax-распределению, с matched ON/OFF/SHAM на нескольких контекстах.

## Результаты
- 4 контекста: epistemic, autonomy, maintenance, mixed.
- Средний causal policy L1: ~0.0780.
- Средний SHAM L1: ~0.0178.
- Causal/SHAM ratio: ~4.38x.
- Каждый контекст проходит минимальный causal threshold >= 0.05 на уровне aggregate policy effect.
- Persistent structural lesion B269: 90%, 43/48 нейронов, 286/288 синапсов removed.

## Интерпретация
B269 теперь доказанно causally active в SPINE_ONLY: структурная абляция меняет будущую action distribution сильнее, чем контрольное weight-perturbation вмешательство.

Это не доказывает, что B269 является единственным или главным источником всего поведения организма. Constitutional arbitration, B299, world prediction и другие слои остаются.

## Кирпичи
- Brick 0: PASS
- Brick 1: PASS
- Brick 2: host mobile-profile long-horizon PASS; physical Android gate OPEN
- Brick 3: causally active, multi-context SHAM-controlled PASS; strength = moderate
- Brick 4+: не начинались в этом release
