# V126 → V127

## Главный фронт

**Collision-Resistant Memory + Segmented Sparse Runtime + Continual-Learning Gate**

1. Провести matched fast-only vs fast+slow consolidation на sequence-continuation и task-shift задачах.
2. Измерить retention, plasticity и interference до/после consolidation.
3. Сопоставить memory capacity 256/1024/4096/16384 slots при одинаковом budget.
4. Убрать полную материализацию flat sparse state через segmented/paged state representation.
5. Отдельно измерить CPU time, allocations, memory bandwidth и batch-scaling.
6. Проверить fingerprint/admission только через shared production path; никаких вторых read implementations.
7. Добавить promotion gate: candidate допускается в current только при устойчивом gain на независимых seeds и приемлемой стоимости.
8. Продолжить anti-decoration audit: executable stubs, inert configuration, dead outputs, duplicate owners, duplicate truth and stale version metadata.

## Stop rule

Если механизм меняет состояние, но не улучшает downstream task under matched control, он остаётся candidate или удаляется.
