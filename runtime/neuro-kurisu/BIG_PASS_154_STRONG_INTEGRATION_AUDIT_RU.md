# Neuro-Kurisu — BIG PASS 154: Strong Autonomous Cognitive Life Integration

## Цель

Единым проходом усилить восемь следующих направлений проекта: closed-loop cognition, долгую автономную жизнь, active perception, causal self-development, longitudinal personality emergence, research/ablation, embodied interaction и consciousness-oriented evaluation.

## Что реально внедрено

1. **Closed-loop cognition** — добавлен `AutonomousCognitiveLifeEngine`: prediction records, decision/outcome pairing, prediction error, causal attribution, verified outcomes и обратная калибровка action/agency metrics.
2. **Long-term autonomous life** — persistent intentions, commitments, stale-intention expiry, resumption state, autonomous ticks и bounded action bias.
3. **Active perception** — ranking perception candidates по expected information gain, actionability, social/self relevance и cost; выбранное наблюдение доступно через runtime API.
4. **Causal self-development** — outcome-linked calibration и controlled research trials; ablation работает shadow-only и не мутирует каноническое состояние.
5. **Longitudinal personality** — динамика curiosity/persistence/caution/sociability/reflection/autonomy/adaptability вычисляется из контекста и истории, а не как статическая конфигурация.
6. **Research / ablation** — benchmark, longitudinal points, research trials, component sensitivity; изменения не выдаются за доказательство сознания.
7. **Embodiment** — energy/capacity/thermal/sensory/recovery/overload входят в action feasibility, embodied agency и recovery metrics, используя существующие body signals.
8. **Consciousness-oriented evaluation** — результаты маркируются как functional evidence, reproducible metrics и controlled sensitivity; subjective consciousness не предполагается.

## Интеграция в организм

Новый слой подключён к `OrganismCore` через:
- cycle initialization;
- cross-system context builder;
- action selection bias;
- decision recording;
- outcome learning;
- persistence;
- diagnostics/benchmark;
- server endpoint `/api/organism/autonomous-cognitive-life`.

Состояние схемы повышено до 124 с backward-compatible migration/defaults.

## Проверка

- `TYPECHECK=PASS`
- `BIG_PASS_128_154=PASS`
- `BIG_PASS_128_154_CORE=PASS`
- `BIG_PASS_128_154_SERVER=PASS`
- BIG PASS 116–125 regression: PASS
- `CORE_OWNERSHIP=PASS`
- `CLEAN_ARCHITECTURE=PASS`, cycles=0
- `SOURCE_HYGIENE=PASS`
- `FORENSICS=PASS`
- `CLEAN_INTEGRITY=PASS`
- `RELEASE_CONTRACT=PASS`
- `RELEASE_SOURCE=PASS`

## Контроль честности

Functional scores are engineering measurements. They are not evidence of subjective experience. Research interfaces remain bounded/shadow-only where appropriate; no self-modification is silently auto-applied.

## Что ещё не является доказанным

- реальная субъективность;
- феноменальное сознание;
- человеческий уровень общего интеллекта;
- надёжная долговременная автономия на неделях/месяцах без реального longitudinal experiment;
- реальная embodied agency вне доступных исполнительных интерфейсов устройства.
