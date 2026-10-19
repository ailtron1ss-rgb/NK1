# P40 — Semantic Intelligence & Model Ecology

## Практический эффект шага
P40 превращает P37 sensorium в более устойчивый временной semantic layer и делает выбор LLM/модели зависимым от качества, надёжности, latency, стоимости, локальности, доступного ресурса и continuity. Это влияет на runtime, а не только на telemetry.

## Что добавлено
- `P40SemanticIntelligenceEngine`: временные semantic situations, claims, entity continuity, causal hypotheses, focus и action-bias.
- `P40ModelEcologyEngine`: каталог доступных backends, профиль качества/стоимости/latency/reliability, selection и online observation после реального language backend результата.
- P40 подключён к `OrganismCore`, persistence и HTTP API.
- P40 action bias участвует в ranking, model ecology участвует в language invocation.
- Модель после фактического ответа получает online update своего профиля.

## Чего P40 сознательно НЕ утверждает
- нет собственного raw-image neural encoder;
- нет raw-audio semantic encoder;
- нет human-level multimodal understanding;
- нет доказательства субъективного опыта;
- нет полноценной внешней causal intervention.

## Архитектурный принцип
Perception informs agency; perception does not become agency.
Model ecology recommends execution backend; она не меняет identity/personhood напрямую.

## Ограничения телефона
P40 вычислительно мал. Основной расход остаётся за LLM, multimodal backends, I/O и Android lifecycle. Криптографические checkpoint-хеши остаются на границе persistence, а не в каждом sensor tick.
