# V96 → V97 next frontier

## Главная цель
Не добавлять ещё один recurrent backend, а сделать способность сети **восстанавливать и перестраивать plasticity на уровне отдельных параметров** измеримой и управляемой.

## V97 большие шаги
1. **Selective weight regeneration** — реальный weight-level reset вместо whole-unit reset; контролировать gradient inactivity, age, contribution и reset budget.
2. **AdaLin-style adaptive linearity** — parameter-local нелинейность/линейность как отдельный candidate; измерять gradient flow и continual adaptation.
3. **Fast→slow consolidation** — проверять, может ли кратковременная fast plasticity переносить полезные изменения в slow substrate без второго memory owner.
4. **Matched long-horizon CL** — 5+ seeds, task switches, forgetting, recovery, adaptation speed, memory recall.
5. **Promotion gate** — candidate попадает в current только после matched baseline + ablation + resource check.

## Не делать
- не создавать новую цепочку VXX inheritance;
- не делать вторую long-term memory;
- не считать synthetic smoke-test доказательством общего улучшения;
- не оставлять failed candidates в current execution path.
