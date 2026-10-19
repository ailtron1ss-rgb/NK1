# P2855 — Research & Design

## Инженерный вопрос
Как превратить контекстную slow-memory в реальный action-selection signal, сохранив bounded memory и мобильную стоимость.

## Design choice
P2855 использует компактный contextual value table поверх learned 16D prototypes. Prototype retrieval отделён от action value update: representation отвечает за принадлежность к контексту, value layer — за reward-conditioned action preference. Обновление ограничено bounded advantage и фазой offline consolidation.

## Почему не только копирование slow-memory values
P2854 уже содержит context/schema action values. P2855 использует отдельный узкий policy channel, чтобы его вклад можно было подвергнуть прямой ablation-проверке и отдельно измерить persistence, holdout и action success. Это позволяет различать memory retrieval от actual policy utility.

## Benchmark protocol
1. Controlled contextual bandit с пятью независимыми контекстами.
2. No-learning/ablation контроль на полном `NeuralExperienceBranch`.
3. Snapshot/restore equivalence.
4. Регрессии P2852–P2854.
5. Runtime и mobile256 smoke.

## Результаты
Controlled policy: training reward 0.9103, holdout accuracy 1.0, retention 1.0. Integrated ablation: +0.10 absolute action accuracy. Это функциональный сигнал, но integrated absolute accuracy остаётся низкой (0.2667), поэтому нельзя считать policy solved.

## Следующая гипотеза
Следующий полезный шаг — связать policy confidence с cross-layer arbitration и causal outcome credit, затем измерять `taskSuccess/actionSuccess` на long-horizon A→B→C→A→D→E→A, включая negative-transfer and recovery trials. Не следует просто увеличивать коэффициент action bias без независимого task benchmark.
