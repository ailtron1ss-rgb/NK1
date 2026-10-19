# B376 — NEURAL GOAL ECOLOGY / AUTONOMOUS GOAL CONTINUITY

## Статус
CURRENT — 2026-09-15

## Цель
B375 доказал causal goal authorship: организм способен отличать внутреннюю цель от внешней и менять goal-authoring readout после verified outcome. B376 закрывает следующий пробел: цель должна жить после момента генерации, продолжать выполняться без повторной подачи кандидата, накапливать прогресс, останавливаться/завершаться по причинным последствиям и при завершении создавать преемника.

## Архитектурное решение
Не создаётся второй planner и не создаётся новый neural decision owner. Goal ecology встроена непосредственно в B365.

Цепь:

`internal goal candidate → ownership/commitment → persistent goal ecology memory → autonomous continuation → verified progress → completion/pause/abandonment → successor → future B365 policy`

## Новое состояние
- `activeId`
- bounded memories до 24 целей
- status: `incubating | active | paused | completed | abandoned`
- progress, persistence, value
- attempts/successes/failures/revisions
- autonomousCycles
- selfContinuationCycles
- completed/abandoned/paused/resumed/revisions
- successorCreations
- competitionEntropy01

## Causal properties
1. Цель принимается только через существующий B375 ownership gate.
2. После первого tick цель продолжает жить без повторной передачи `goalAuthorship`.
3. Только verified + independent evidence меняют progress/goal lifecycle.
4. Completion возможна только после достаточного verified progress.
5. Completion создаёт внутреннего successor кандидата без внешнего reseeding.
6. Ecology OFF отключает lifecycle completion/successor path.
7. State сохраняется после restart.

## Почему это важно
Это переводит систему от `goal as request` к `goal as persistent organismal process`. Самостоятельность начинает измеряться продолжением собственной цели во времени, а не только разовым выбором действия.


## Дополнительное усиление после первичного теста
Successor после verified completion теперь автоматически promoted в текущий `goalAuthorship.candidateId` и продолжает участвовать в B365 без внешнего reseeding. Это устраняет разрыв между 'successor записан' и 'successor реально живёт'.
