# Research index — P2599–P2612

Дата: 2026-09-18

## Главные направления, принятые для проекта

### 1. Иерархическое планирование в latent world model
**Zhang et al., 2026 — Hierarchical Planning with Latent World Models**

https://arxiv.org/abs/2604.03208

Вывод для проекта: длинный поиск выгоднее разделять на temporal scales и связывать долгий прогноз с краткосрочным исполнителем. В проекте это реализовано облегчённо: H1/H2/H4/H8/H16 + meta-skill layer + compute gate.

### 2. Actionable world models
**Yao et al., 2026 — World Models for Embodied Intelligence: From Plausible to Controllable to Actionable**

https://arxiv.org/abs/2609.16697

Ключевой критерий — улучшение замкнутого поведения: planning, action, learning, verification, recovery, data selection. Поэтому новые механизмы оцениваются по downstream loop, а не по одной ошибке предсказания.

### 3. Test-time adaptation
**Wang et al., 2026 — AdaJEPA: An Adaptive Latent World Model**

https://arxiv.org/abs/2606.32026

Вывод: world model может корректироваться непосредственно по реальному observed transition во время MPC-loop. В проект добавлен ограниченный residual adapter с bounded online update.

### 4. Совместное развитие procedural/meta-skills
**Feng et al., 2026 — CoSkill: Joint Reinforcement Learning of Reasoning and Meta-Skill Agents for Hierarchical Skill Evolution**

https://arxiv.org/abs/2609.04865

Источник помечен авторами как withdrawn pending internal content review; поэтому он используется только как архитектурная гипотеза, а не как подтверждённый benchmark.

### 5. Continual optimization через procedural skills
**Yao et al., 2026 — MASkills**

https://arxiv.org/abs/2609.02094

Вывод: skill units полезно подвергать refinement, induction, consolidation и pruning вместо бесконечного накопления отдельных воспоминаний.

### 6. Multi-horizon test-time scaling
**Chen et al., 2026 — ParallelWorld: Test-Time Scaling for Embodied Reasoning**

https://arxiv.org/abs/2608.22971

Вывод: длинный горизонт лучше обслуживать несколькими масштабами планирования, а не только монотонным увеличением одного rollout.

## Ограничения переноса

Ни один из этих результатов не доказывает наличие сознания или общей интеллектуальности у Neuro Kurisu. Для нашего проекта они являются источниками инженерных гипотез и конструктивных паттернов, которые должны подтверждаться собственными ablation/holdout тестами.
