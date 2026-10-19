# B2515–B2517 Research Note — Unified Latent/Causal/Self Stack

## Исследовательская мотивация

Свежий обзор 2026 года по world models для embodied intelligence предлагает оценивать predictive systems не по визуальной правдоподобности, а по тому, улучшают ли они closed-loop planning, action, learning, verification и recovery. B2515 поэтому используется как shared state bridge, который возвращает learned latent обратно в B2503/B2504/B2505 на следующем цикле.

Работы 2026 года по World Action Models дополнительно подчеркивают совместное моделирование будущих состояний и действий. В нашей архитектуре B2516 и B2517 используют shared latent + stable goal/self context как переход от prediction к долговременной action-conditioned causal memory.

Свежая Nature Communications работа о hippocampo-neocortical interaction моделирует replay episodic representations для обучения более general semantic representations. Это поддерживает разделение raw episodic provenance (B2512) и generalized causal/self rules (B2516/B2517).

## Реализованный эксперимент

Контролируемый hidden-rule holdout:
- baseline reward: 210.0;
- B2515–B2517 reward: 376.25;
- relative reward gain: +79.17%;
- correct actions: 375/400;
- baseline correct: 200/400;
- accuracy: 93.75% против 50%;
- compiled rules: 27;
- consolidation cycles: 40;
- self-authorship metric: 0.963.

Результат относится к контролируемой synthetic задаче и не является доказательством сознания или человеческой личности.

## Архитектурный принцип

experience → shared latent → verified causal transition → stable goal/self rule → future action → new outcome.

Ключевое требование — не позволять шумному momentary latent напрямую переписывать identity. Поэтому B2517 индексирует rules по стабильному goal/self context и обновляет их только при verified/autonomous evidence.
