# P32 Final Report

P32 переводит P31 от преимущественно функционального consciousness scaffold к проверяемому causal-self loop. Ключевая связка: prediction → action → outcome → self-model revision.

Новая версия: 8.2.0; schema 35.

Релиз нельзя интерпретировать как доказательство субъективного сознания. Он даёт функциональные и причинно-структурные свойства, которые можно подвергать вмешательствам.

## Дополнительные hardening-изменения
Lesion endpoint по умолчанию работает транзакционно и не портит живое состояние. Поле `selfStateHash` теперь строится по полному causal-self model material, а не только по нескольким агрегатам.

## Итоговая оценка P32
P32 не добавляет claim о phenomenal consciousness. Он добавляет causal self-modeling: собственное действие становится гипотезой о причинности, outcome — наблюдением, mismatch — основанием для revision. Lesion по умолчанию транзакционный и не изменяет живое состояние.

Ключевые ограничения: controlled intervention record зависит от внешних фактов independent conditions/repetitions; реальный device verification отсутствует без физического POCO; semantic vision/audio остаются неполными; subjective experience не измеряется этим runtime.
