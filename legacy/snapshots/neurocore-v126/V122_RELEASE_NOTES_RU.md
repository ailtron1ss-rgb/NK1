# V122 — Release Notes

## Результат прохода

V122 не пытается увеличить количество подсистем. Основной эксперимент — увеличить effective memory capacity внутри уже существующего recurrent owner.

Лучший текущий candidate: **1024 sparse slots (32×32), decay=0.9999**. На direct probe со свежими данными средние показатели по 3 seed:

| Delay | Cosine | Amplitude | Relative MSE |
|---:|---:|---:|---:|
| 32 | 0.99999 | 0.995 | 0.00008 |
| 128 | 0.99913 | 0.896 | 0.015 |
| 512 | 0.99737 | 0.808 | 0.053 |
| 2048 | 0.98173 | 0.531 | 0.249 |
| 4096 | 0.94196 | 0.389 | 0.426 |

Это **не** означает end-to-end memory mastery: direct cell qualification отделена от model learning. В коротком matched training candidate остаётся примерно на уровне dense baseline; устойчивого прироста, достаточного для promotion, пока нет.

Isolation probe при delay 128/512 сохраняет высокий own-target cosine и низкий cross-leak, что подтверждает реальную раздельность нескольких событий, но ещё не доказывает масштабируемость при насыщении.

## Вердикт

`unified_sparse_associative_memory_v122`: **IMPLEMENTED + FUNCTIONAL INDICATOR + CANDIDATE**.

`collision_aware_sparse_admission_v122`: **IMPLEMENTED + TESTED + NOT PROMOTED**.

Следующий проход должен атаковать две вещи: collision-resistant admission и state representation/kernel efficiency.
