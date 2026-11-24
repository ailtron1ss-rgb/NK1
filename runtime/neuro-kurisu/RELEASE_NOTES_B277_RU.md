# Release Notes B277

## B277 Neural Operator Genesis
Большой апдейт нейронной ветви: появился отдельный обучаемый neural operator layer.

### Основные изменения
- sparse top-k neural activity;
- context-conditioned dendritic action decoding;
- recurrent operator links;
- local reward/prediction-error plasticity;
- homeostatic firing control;
- operator maturity/verification/rejection;
- transfer testing;
- B276→B277 neural germination bridge;
- OrganismCore persistence and migration.

### Quality
Полная проверка текущего дерева выполняется отдельными статическими и функциональными gate'ами; никакой timeout объединённого mega-run не объявляется PASS.
