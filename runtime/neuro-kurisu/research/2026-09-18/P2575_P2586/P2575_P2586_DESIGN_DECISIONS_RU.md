# Design Decisions — P2575–P2586

## D1. Dream rehearsal принадлежит causal planner, а не внешнему storage
Причина: actor/policy слой должен получать отложенный credit непосредственно из verified semantic rules.

## D2. Репетиция graded, а не unconditional
Используются confidence, support, contradiction и agreement с последним реальным trace. Низкокачественные правила не репетируются.

## D3. Model-time вместо fixed tick schedule
Forgetting debt растёт от реального learning/update magnitude и prediction disagreement. Приоритет replay определяется состоянием модели.

## D4. Конфликт не удаляет воспоминание автоматически
Сначала увеличивается contradiction/negative transfer. Это сохраняет возможность альтернативных гипотез и предотвращает агрессивное destructive overwrite.

## D5. Replay ограничен bounded budget
Потому что проект ориентирован на средний Android. В текущем проходе максимум dream rehearsal = 6 кандидатов за maintenance cycle.

## D6. Self-rehearsal не считается «реальным обучением из мира»
Dream updates отдельно учитываются в diagnostics, чтобы нельзя было случайно выдать imagined learning за externally grounded learning.
