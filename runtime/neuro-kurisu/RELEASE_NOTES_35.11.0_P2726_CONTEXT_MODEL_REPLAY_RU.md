# Neuro-Kurisu 35.11.0 / P2726 — Context-conditioned Model Replay

Дата: 2026-09-20

## Production change
P2726 расширяет P2724 в том же neural continual loop: контекстно-условные модели действий, online latent-transition model и adaptive replay mixture.

Ключевой causal spine:
`context → action model → latent transition → lookahead → replay mixture → neural update → persistence`

## Что изменилось
- context-conditioned action model для каждого активного контекста;
- 8-мерная action-conditioned latent transition model;
- confidence/uncertainty-aware planning;
- replay policy mixture `priority/context/novelty/random`;
- online adaptation replay mix по novelty, boundary, forgetting pressure и ресурсам;
- snapshot/restore новых состояний;
- state version `23`, release schema `201`.

## Verification
- `P2726_CONTEXT_MODEL_REPLAY=PASS` — 240 outcomes, 3 contexts, ctxModelSamples=240, latentSamples=240, replay=96/240, replayUsed=494, planDepth=2, rollouts=14, trajectoryDiff=67.0240, restart=PASS.
- `P2724_MOBILE_ENDURANCE=PASS` — 1500 cycles / 750 outcomes, latest host max heap growth 24.7 MB, end growth 45.3 MB, restart=PASS.
- `P2716_CONTINUAL_BATTERY=PASS` — expForgetA=0.0395 vs control=0.0668 in this matched run; benchmark-specific only.
- `P2708_CONTINUAL_FACTORIAL=PASS` — expForgetA=0.0322 vs control=0.0267; retained as a negative counterexample.
- Existing P2720/P2716/P2708 regression batteries are re-run after P2726 integration.

## Ограничения
P2726 показывает работоспособную интеграцию, но не доказывает универсальное улучшение forgetting/performance и не является доказательством сознания. Physical Android/Termux evidence остаётся отдельным пунктом.
