# Карта искусственного мозга

Это research + implementation layer for Neuro-Kurisu 35.6.1. Базовая карта остаётся историческим research snapshot, а BIG PASS 207 добавляет исполняемые brain-ontology/routing компоненты.

- `KARTA_ISKUSSTVENNOGO_MOZGA_35.6.1_RU.docx` — основной отчёт.
- `KARTA_ISKUSSTVENNOGO_MOZGA_35.6.1_RU.md` — текстовая версия.
- `KARTA_ISKUSSTVENNOGO_MOZGA_35.6.1_MACHINE.json` — машиночитаемая карта.
- `BRAIN_MAP_SOURCE_FREEZE_35.6.1.json` — исторический inventory SHA-256 исходной карты.
- `BRAIN_IMPLEMENTATION_STATUS_207_RU.md` — фактический статус внедрения карты в код.
- `BRAIN_IMPLEMENTATION_STATUS_207_MACHINE.json` — машиночитаемый статус.
- `BRAIN_ARCHITECTURE_RULES_207_RU.md` — правила дальнейшего развития brain-ветки.

BIG PASS 207 впервые изменяет source code: добавлены `ArtificialBrainAtlas` и `ThalamocorticalGate`, а gate подключён к центральному cognitive kernel.


## Current implementation: B-M3

Basal ganglia action-selection circuit is implemented as a computational analogue with explicit direct/indirect/hyperdirect-like signals, dopamine-gated plasticity, lesion testing and Core persistence. See `BIG_PASS_208_BASAL_GANGLIA_RU.md`.
