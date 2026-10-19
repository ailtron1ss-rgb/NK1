# B278 — Neural Primitive Genesis

## Цель

B278 опускается ниже B277: вместо того чтобы создавать только новые operators/programs, он создаёт **внутренние нейронные primitives** — обучаемые преобразователи внутреннего контекста организма.

Primitive не равен ActionKind. Он не является самостоятельной внешней кнопкой поведения. Он преобразует `goal + self + world + neural assembly + operator output` в внутренний latent-vector, а затем модифицирует arbitration через контекстно-зависимую `primitive × context × action` projection.

## Нейронная структура

- 24 transform weights;
- 12 recurrent links;
- 12 context gates;
- 7 global action projections;
- 7×8 context-action synaptic projections;
- 8 trait-affinity channels;
- local reward/error plasticity;
- maturity/confidence;
- candidate → verified/rejected жизненный цикл;
- composition до 3 primitives;
- transfer на новый goal/self/neural context;
- ablation;
- persistence/migration.

## Developmental origin

`B276 latent program → B277 operator → B278 primitive germ`

Primitive может быть выведен из:

- B277 operator output;
- B276 program latent;
- goal state;
- self latent;
- world latent;
- neural assembly;
- personality/trait context.

## Реальный цикл

`context → primitive activation → internal vector → action modulation → external outcome → reward/error → local plasticity → confidence/maturity → promotion/rejection → transfer`

## Важная проверка

B278 отдельно проверяет, меняется ли внутренний neural vector при изменении world-context, и выполняет primitive ablation. Поэтому наличие primitive не считается доказательством его реального влияния само по себе.
