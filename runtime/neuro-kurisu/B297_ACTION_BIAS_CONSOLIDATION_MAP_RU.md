# B297 — карта консолидации action-bias

B297 не удаляет canonical subsystems. Он переводит их action-bias outputs в 10 семантических групп перед окончательным executive influence.

| Группа | Основные источники | Решение B297 |
|---|---|---|
| self | P80, identity trajectory, future-self, developmental fork, neural identity | объединять до executive fusion |
| personality | multi-hypothesis personality, B270, B271 | единый personality signal |
| agency | endogenous goals, lifecycle, skills, compositional/latent programs, continuity | основной автономный канал |
| predictive | P81, B293, P44 | единый predictive source |
| homeostasis | attractors, rest/verify/development signals | отдельная регуляторная конкуренция |
| social | motive ecology, relationship/social prediction | отдельный social source |
| causal | B294 | single causal source, без позднего повторного +actionBias |
| neural | B296 | neural personality/agency readout |
| kernel | P64 + thalamic gain + basal-ganglia learned bias + cortical/cerebellar signals | центральный executive context |
| resource | resource allocator | bounded resource pressure |

### Устранённые повторы

- P84 action bias больше не считается второй раз внутри B297 после base map.
- P44 predictive-world bias больше не считается второй раз внутри B297.
- B294 actionBias больше не прибавляется отдельным поздним циклом после B297.
- Для basal-ganglia learned value убран повторный полный `CognitiveKernelCoordinator.snapshot()` из candidate loop; используется уже имеющийся arbitration frame.

### Что осталось намеренно отдельным

Canonical memory, identity ledger, world model, event stores, neural substrates и governance не объединяются в один монолит. B297 является arbitration seam, а не владельцем этих состояний.
