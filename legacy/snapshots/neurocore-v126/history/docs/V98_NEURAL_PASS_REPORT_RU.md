# V98 — Continual Stability / Gradient Protection

## Цель
Два механизма без изменения default numerical path: latent replay-gradient alignment и low-rank gradient-subspace protection.

## Replay gradient alignment
Реализован сигнал cosine между градиентом текущей correction loss и градиентом кандидата replay на уровне latent output. Сигнал действительно считается и сохраняется per-slot, но на коротком full-NeuroCore benchmark не изменил selection rate относительно baseline. Статус: candidate-only.

## Gradient subspace protection
GPM-inspired guard собирает bounded activation reservoir выбранного Linear и строит SVD basis. Weight gradient проецируется как G' = G - alpha G U U^T. Это реальный hook в gradient path и не добавляет trainable parameters.

Isolated 5-seed / 8-task sweep: baseline forgetting 0.113766; guard 1.0 forgetting 0.078823 (-30.7%), final-task cosine 0.245807 vs 0.227544 (+8.0%), wall time +8.3%.

Full-NeuroCore short 3-seed qualification: guard 0.75/1.0 практически не изменили метрики относительно baseline. Поэтому механизм НЕ promoted и остаётся opt-in candidate.

## Evidence boundary
Большие long-horizon runs ограничены временем sandbox и не считаются доказанными результатами.
