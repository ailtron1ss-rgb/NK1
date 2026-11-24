# BIG PASS 71 — план

## Цель
Перевести contextual carry-over P84 от exact-key lookup к similarity-weighted transfer между близкими состояниями, сохранив bounded влияние, signed learning, persistence и отсутствие нового truth-store.

## Принципы
- verified evidence only;
- `unknown` не обучает поведение;
- точный контекст сильнее соседнего;
- соседний перенос затухает по similarity;
- итоговый action bias signed и bounded;
- P84 остаётся частью Self owner;
- память, события и reality остаются каноническими источниками.

## Дополнительный ремонт
Во время прохода исправлен drift версии P84 в `summary()`/migration и восстановлена signed-семантика отрицательного carry-over.

## Верификация
Обязательные проверки: P70 compatibility, BIG PASS 71 similarity transfer, P67/P68 regression, source-truth, architecture, ownership, hygiene, syntax, forensics, integrity, server smoke, restart/concurrency/replay и operational benchmarks.
