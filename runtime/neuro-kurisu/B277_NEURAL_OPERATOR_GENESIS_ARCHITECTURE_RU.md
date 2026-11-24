# B277 — Neural Operator Genesis

## Зачем это сделано
B277 закрывает ограничение B276: primitive ActionKind остаётся фиксированным, поэтому развитая программа всё ещё собирается из заранее существующих действий. B277 вводит отдельную обучаемую внутреннюю способность — нейронный оператор. Оператор не является новым ActionKind; это развивающаяся схема преобразования self/world/goal/assembly-context в действие и внутренний latent output.

## Нейронная модель
- sparse winner-take-all assembly: 3/12 активных unit-победителя;
- recurrent operator links;
- dendritic/context gates;
- context-conditioned action decoder;
- local eligibility/plasticity update;
- prediction-error/third-factor modulation;
- homeostatic firing-rate regulation;
- maturity and verification dynamics;
- structural operator genesis from B276 program latent;
- rejection for persistently poor/high-error operators;
- transfer test into a new goal-context;
- snapshot/migration persistence.

## Единая цепь
B269 spiking substrate → B270 neural self/traits → B271 autobiographical assemblies → B272 endogenous goal → B273 goal lifecycle → B274 skill discovery → B275 neural compositional policy → B276 hierarchical latent program → **B277 neural operator** → action arbitration → real outcome → local plasticity → personality/self evidence.

## Важное ограничение
B277 не доказывает биологическую нейронную эквивалентность и не доказывает субъективный опыт или сознание. Это инженерный, обучаемый, event/sparse-inspired neural subsystem.
