# B312 Evidence Report

## Evidence table

| Проверка | Результат |
|---|---|
| Typecheck | PASS |
| Handoff standalone promotion | PASS |
| Handoff lesion | PASS |
| Handoff safety block | PASS |
| External-request block | PASS |
| Handoff restore | PASS |
| OrganismCore handoff evaluations | 8 |
| OrganismCore verified confirmations | 3 |
| OrganismCore restart | PASS |
| Migration schema | 127 |
| B298 neural regression | PASS |
| B306 autonomy regression | PASS |
| B305 critical path regression | PASS |
| B311 policy ecology regression | PASS |

## Strong evidence

B312 standalone promotion переворачивает `verify -> explore` при достаточно сильном verified policy state.

В живом core handoff действительно достигает final decision boundary и фиксирует 3 verified-policy confirmations.

## Important limitation

Короткий whole-organism baseline-vs-trained experiment не дал естественного распределительного сдвига: обе ветви дали 6 `explore` и 2 `verify`. Поэтому B312 не объявляет P6 закрытым.
