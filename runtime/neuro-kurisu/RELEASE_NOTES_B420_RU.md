# Release Notes — 35.6.34 / B420

## B401–B420 Research Upgrade

Новый экспериментальный developmental research layer с семью конкурирующими механизмами:

- surprise-memory;
- continuum-memory;
- state-space;
- latent-predictor;
- counterfactual;
- goal-value;
- population-code.

Добавлены online weights, retention, retrieval, short rollout, lesion API, persistence и hidden-rule Olympics.

## Architectural closure

Research layer подключён к ordinary full OrganismCore path.

Canonical policy ownership не изменён.

## Persistence fix

B385/B391/B401 добавлены в StateMigrations и теперь сохраняются после полноценного restart.

## Mobile efficiency

Введён adaptive compute budget, который снижает частоту тяжёлого research ensemble на mobile profile без удаления последнего verified signal.

## Verification

Все critical audit layers и regression suites прошли после финальных изменений.
