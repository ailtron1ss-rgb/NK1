# P2726 — Context-conditioned model replay + latent transition

Дата: 2026-09-20

## Цель
Устранить два остаточных узких места P2724: глобальность action model при нескольких contexts и слишком узкий replay policy.

## Реализация
1. Context-conditioned action models: running mean/uncertainty/confidence для каждого context × action.
2. Latent transition model: по 8 латентным координатам на action, online delta + uncertainty + confidence.
3. Lookahead: confidence-aware latent consistency добавляется к shallow planning value.
4. Replay mixture: adaptive `priority/context/novelty/random` quotas вместо единственного ranking policy.
5. Persistence/restore всех новых полей.

## Evidence
`P2726_CONTEXT_MODEL_REPLAY=PASS outcomes=240 contexts=3 ctxModelSamples=240 latentSamples=240 latentConf=0.5442146095585917 replay=96/240 replayUsed=494 mix=0.365,0.308,0.230,0.098 entropy=0.9350 planDepth=2 rollouts=14 trajectoryDiff=67.0240 restartOutcomes=240`

## Ограничения
Это synthetic/host evidence. Никаких утверждений о сознании, универсальном превосходстве или реальной Android performance из одного прогона нет. Следующая независимая проверка должна сравнить no-replay/random/context-only/adaptive replay и несколько последовательностей задач.
