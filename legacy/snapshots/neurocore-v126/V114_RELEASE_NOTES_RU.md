# V114 Release Notes

V114 — инженерно-исследовательский релиз над compact causal trunk. Главный новый результат — доказанный на current synthetic multi-objective path разрыв между конфликтами objective-gradients и фактическим AdamW update: после PCGrad средний raw update-conflict был около 0.95 на трёх seed'ах.

Post-update alignment снижает этот конфликт до 0.14–0.43 в одношаговых probe, но остаётся candidate-only: текущая реализация не переписывает AdamW moment state, поэтому полная квалификация требует отдельного long-horizon state-aligned эксперимента.
