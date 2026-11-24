# BIG PASS P2575–P2586 — CONTINUAL DREAM REHEARSAL + CAUSAL MEMORY

## 1. Цель прохода
Укрепить непрерывность искусственного организма так, чтобы накопленная world-model knowledge не отделялась от action/policy memory. После нового опыта организм должен уметь возвращать проверенные навыки через bounded internal rehearsal, не выдавая внутреннюю репетицию за внешнее обучение.

## 2. Реальные изменения кода

### P2575 — Model-Time Memory Scheduler
`AdaptiveCausalMemoryPlanner` получил `modelTime01` и `forgettingDebt01`.
Replay/rehearsal budget зависит от измеряемого learning pressure, prediction disagreement и накопленной задолженности забывания, а не только от raw tick count.

### P2576 — Graded Dream Rehearsal
Добавлен `dreamRehearse(budget)`.
Он выбирает только правила с достаточной support/confidence и низким contradiction, затем переносит их graded credit обратно в action-value/confidence/retention.

### P2577 — Protected Procedural Skills
Добавлены `protectedActionSkill01` и `skillRetention01`. Они участвуют не только в diagnostics, но и дают bounded protection action score.

### P2578 — Conflict-Aware Memory
Похожие context+action с несовместимым successor delta теперь увеличивают contradiction/conflict/negativeTransfer. Такие правила автоматически получают меньше влияния в planning.

### P2579 — Negative Transfer Gate
Rule bonus уменьшается при росте `negativeTransfer01`, чтобы похожая, но противоречащая память не могла доминировать над decision loop.

### P2580 — Persistence v2
Causal planner state повышен до v2. Сохраняются dream count, forgetting debt, protected skills, conflict statistics и model time.

### P2581–P2586 — Research-grade regression/ablation
Добавлены отдельные dream/no-dream, integrated neural и performance benchmarks, плюс release-state documentation.

## 3. Измеренный результат

### Dream vs plain
- Dream rehearsal cycles: 171
- Dream policy updates: 413
- protected skill: 0.5075
- retention: 0.6131
- plain retention: 0.5000
- retention delta: +0.1131
- last dream quality: 0.7097
- conflict count: 581
- negative transfer: 0.1393

### Neural integrated
- 768 cycles
- 48 dream rehearsal cycles
- 178 dream updates
- skill retention vector: 0.651 / 0.520 / 0.542 / 0.612 / 0.549 / 0.593 / 0.601
- conflict count: 13
- negative transfer: 0.0515
- causal sensitivity: 0.1324
- transfer: 0.9058
- foresight quality: 0.8816

### Performance
12,000 planner cycles:
- 0.367 s
- ~32.7k cycles/s
- 3,000 dream updates
- 750 rehearsal cycles
- 256 bounded traces

## 4. Что НЕ утверждается
Dream rehearsal не считается внешним learning. Он измеряется отдельно и нужен для проверки stability/plasticity. Результаты benchmark не являются доказательством общего интеллекта, сознания или биологической эквивалентности.

## 5. Следующая ветка
P2587–P2598: task-transfer holdout, real sensor/action adapters, stronger intervention benchmark, actor-vs-world retention matrix, Android thermal scheduling and compact latent-world replacement for the weak B2521 loop.
