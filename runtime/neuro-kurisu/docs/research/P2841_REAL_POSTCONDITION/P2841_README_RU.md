# P2841 — Reality Postcondition & Grounded World

P2841 продолжает Reality Boundary P2840. Основной новый принцип: факт исполнения команды и факт достижения ожидаемого внешнего эффекта больше не считаются одной и той же сущностью evidence.

## Pipeline

`prediction -> shadow -> action -> raw receipt -> postcondition classification -> grounding arbitration -> grounded world -> learning`

## Proof classes

- `independent-observation` — свежий независимый device observation после действия.
- `stable-device-receipt` — команда принята устройством, но ожидаемый физический эффект независимо не проверен.
- `derived-state-transition` — локальное embodied state действительно изменилось, но это не самостоятельный proof внешнего мира.
- `none` — postcondition proof отсутствует.

## Design rule

Чем выше evidence quality и повторяемость причинной связи, тем сильнее допустимая promotion в neural/world/memory/identity substrates.

P2841 намеренно не добавляет второй world model или второй memory engine. Он усиливает уже существующие владельцы reality grounding, grounded world и learning gate.
