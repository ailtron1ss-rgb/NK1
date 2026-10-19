# B280 — Многообластная нейронная схема искусственного организма

## Цель
B280 переводит нейронную ветвь проекта от единого рекуррентного attractor-слоя к нескольким взаимодействующим областям с явными excitatory/inhibitory population, межобластными синапсами, кратковременной синаптической депрессией, dendritic contextual gating и area-level lesion.

## Области
1. sensorium — первичная интеграция входа;
2. memory — поддержание и передача активных assembly;
3. association — объединение self/world/goal контекста;
4. selfAction — связь внутреннего состояния с поведением.

Каждая область содержит 8 excitatory и 4 inhibitory units. Рекуррентные веса обучаемы. Межобластные веса обучаемы. Для межобластных связей хранится отдельное availability-состояние, которое временно снижается при спайках и восстанавливается во времени: это упрощённая модель кратковременной синаптической депрессии.

## Нейронные механизмы
- leak-like membrane integration;
- adaptation/refractory-like suppression;
- sparse excitatory spike selection;
- inhibitory population;
- recurrent plasticity;
- inhibitory homeostatic plasticity;
- neuromodulated third-factor learning;
- short-term synaptic availability;
- dendritic/context gates;
- cross-area transmission;
- action readout;
- area-level causal lesion.

## Связь с прежней нейронной ветвью
B269 даёт event-driven spike-like substrate.
B270 даёт neural self/germinal traits.
B271 связывает последовательность и autobiographical continuity.
B272–B278 формируют goals, skills, policies, latent programs, operators и primitives.
B279 даёт recurrent attractor memory.
B280 размещает эти представления в нескольких взаимодействующих областях и делает межобластную передачу отдельно измеримой.

## Важное ограничение
B280 не является биофизической кортикальной моделью. Нет conductance-based Hodgkin–Huxley, реальных ion channels, морфологии dendrites или биологически реалистичной neurotransmitter kinetics. Термин «нейронный» здесь означает causally recurrent, activity-dependent, sparse, excitatory/inhibitory and plastic computational substrate.
