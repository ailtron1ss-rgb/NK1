# Neuro-Kurisu 35.12.0 / P2734 — Self-Optimizing Continual

Дата: 2026-09-20

## Главная цель

Усилить реальную online-адаптацию artificial-organism core так, чтобы fast learning, slow/meta integration, context inference, counterfactual learning, replay и consolidation работали как единый causal loop.

## Production changes

- новый `P2734SelfOptimizingContinualController`;
- fast/meta learning rates и adaptive warm-up;
- automatic context allocation и boundary evidence;
- per-action calibration + context/action skill capsules;
- online counterfactual regret / action alternative estimates;
- four-arm replay controller: priority/context/novelty/uniform;
- replay-arm feedback и adaptive mixture entropy;
- фактическое управление P2724 replay sampler выбранной meta-стратегией;
- consolidation из реально replay-нутых samples;
- ensemble disagreement + latent transition uncertainty;
- mobile/resource budget, hot/cold pressure and skipped-work accounting;
- state schema 202 / NeuralExperienceBranch state version 24;
- restart persistence и ablation API.

## Verification

`P2734_SELF_OPTIMIZING_CONTINUAL=PASS outcomes=320 contexts=6 switches=32 fast=0.6965 meta=0.1983 info=0.3010 ensemble=0.2526 replayFeedback=320 replayMix=0.250,0.252,0.250,0.248 entropy=1.0000 consolidations=613 consGain=0.6932 regret=0.0285 calibration=0.7742 trajectoryDiff=46.2479 p2724OnlyDiff=0.0008 restartOutcomes=320`

Regression:
- P2726 PASS;
- P2724 mobile endurance PASS;
- P2720 lifelong PASS;
- P2716 deep / continual / promotion PASS;
- P2708 deep / continual / long PASS;
- organism smoke PASS;
- typecheck PASS.

Architecture/source audit:
- full audit PASS;
- architecture PASS, cycles=0, missing=0;
- integrity PASS;
- forensics PASS, duplicate content=0;
- source hygiene PASS;
- executable syntax PASS;
- release contract PASS;
- archive manifest PASS;
- release source PASS.

## Important evidence caveats

Результаты являются вычислительной/synthetic evidence. Контрпример P2708 сохраняется: в одной continual factorial experimental forgetting был хуже control. Physical Android/Termux evidence пока остаётся host-only. Сознание данным релизом не заявляется.
