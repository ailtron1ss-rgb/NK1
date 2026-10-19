# Release Notes — B279

## Главное

Добавлен Neural Attractor Assembly substrate, интегрированный с B278, OrganismCore и StateMigrations.

## Основные изменения

- recurrent attractor memory;
- sparse assemblies;
- noisy cue recall;
- recurrent Hebbian consolidation;
- reward/error plasticity;
- Oja-like input plasticity;
- homeostatic scaling;
- replay;
- causal recurrent lesion;
- action bias;
- persistence/migration.

## Исправления

- исправлена зависимость между train/inference контекстами;
- lesion теперь измеряется новым settling pass;
- B279 добавлен в export index;
- добавлены B279 npm scripts;
- обновлён release/audit evidence.

## Ограничения

B279 — алгоритмический attractor substrate, а не биофизическая модель нейрона.
