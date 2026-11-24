# Следующий шаг после P9

## P10 — Learned World Model 2.0

Следующая цель — заменить оставшиеся ручные assumptions о мире на probabilistic latent/causal dynamics.

### Контур

observe → latent state → causal hypotheses → probabilistic transition → future rollouts → uncertainty → action → outcome → prediction error → model update.

### Критерий перехода

P10 считается успешным не по числу классов, а если learned model начинает улучшать prediction/plan quality на held-out transitions и сохраняет calibration при смене среды.
