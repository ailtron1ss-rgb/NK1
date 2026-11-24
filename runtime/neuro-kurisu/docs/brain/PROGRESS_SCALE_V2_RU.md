# Продвинутая шкала прогрессии Neuro-Kurisu v2

## 8 уровней доказанности

| Level | Название | Что требуется |
|---|---|---|
| P0 | Exists | механизм существует в исходниках |
| P1 | Runs | запускается без exception |
| P2 | Integrated | участвует в каноническом цикле |
| P3 | Persistent | переживает snapshot/restart/replay |
| P4 | Causal | lesion/ablation меняет ожидаемое поведение |
| P5 | Transfer | работает на unseen context/seed/family |
| P6 | Longitudinal | меняет систему на длинном горизонте |
| P7 | Independent | подтверждено отдельным evaluator/replication |

## Индексы

- `Implementation %` — доля функциональной реализации.
- `Evidence %` — доля поведения с доказательством.
- `Causal %` — доля функций с intervention evidence.
- `Transfer %` — unseen generalization.
- `Longitudinal %` — long-run evidence.

## Главный индекс

`OrganismRealityIndex` нельзя считать простой средней. Используется консервативное правило:

`min(Implementation, Evidence, Causal, Transfer, Longitudinal, RealWorld)`

с отдельными supporting indices.

Причина: организм нельзя считать зрелым только потому, что architecture=95, если Longitudinal=20.

## Current B297 baseline

- Implementation ~82
- Evidence ~19
- Causal ~48
- Transfer ~35
- Longitudinal ~25
- RealWorld ~30
- OrganismRealityIndex ~25–30

Этот консервативный индекс специально ниже обычного «feature completion», чтобы код не маскировал отсутствие доказанного живого поведения.
