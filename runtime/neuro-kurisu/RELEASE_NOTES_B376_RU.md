# RELEASE NOTES — 35.6.27 / B377

## Главный апгрейд
B377 превращает цель из кратковременного кандидата в долгоживущий внутренний процесс канонического B365.

### Добавлено
- bounded persistent goal ecology (до 24 goal memories)
- goal lifecycle: incubating → active → paused/completed/abandoned
- autonomous continuation без повторной передачи кандидата
- verified progress accumulation
- persistence/commitment/value dynamics
- completion gate
- successor generation после verified completion
- self-continuation metric
- goal competition metric
- restart persistence
- ON/OFF causal test

### Доказано
Одна internal goal была передана один раз. После этого 17 следующих циклов система продолжала её без reseeding, довела verified progress до 0.942+, завершила её и создала successor.

### Preserved
B365 остаётся единственным neural decision owner. Внешнее приложение не может напрямую присвоить высокое ownership без internal gate. Unverified evidence не меняет goal lifecycle.
