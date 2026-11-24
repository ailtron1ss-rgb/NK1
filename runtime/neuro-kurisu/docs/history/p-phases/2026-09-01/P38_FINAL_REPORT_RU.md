# P38 — Финальный отчёт

## Версия
- Application: 8.8.0
- Organism Core: 35.0.0-p38-autonomous-causal-research-mega-pack
- State schema: 41

## Практический эффект
Организм получил первый автономный causal-research loop. Он выбирает область исследования по внутренним ошибкам, формирует гипотезу, проводит детерминированное sandbox control/treatment сравнение с тремя репликами, требует согласованной репликации и только после принятого результата меняет будущий action bias.

## Нестандартные улучшения
- deterministic research protocol без случайного шума;
- три детерминированные replica runs вместо фиктивного `runs=3`;
- `independent=false` для sandbox replication, чтобы не выдавать синтетические реплики за независимые внешние наблюдения;
- explicit negative-result preservation;
- bounded research budget;
- action-specific behavioural consequence;
- model-based limitation labels;
- server endpoint `/api/organism/autonomous-research`;
- автоматическое включение P38 в полный audit suite;
- исправлен реальный defect в Core→PerceptionEngine: flat phone embodiment теперь адаптируется к ожидаемому `OrganismBodyState.telemetry` и сохраняется до perception.

## Проверено
P29–P38 constituent regression tests — PASS; typecheck — PASS; architecture — PASS; hygiene — PASS; forensics — PASS; legacy — PASS; lockfile — PASS; release source/contract — PASS; archive integrity — PASS.

## Ограничение
P38 sandbox остаётся model-based. Он не доказывает причинность внешней физической среды и не доказывает subjective consciousness.


## Честная репликация
Текущий sandbox выполняет три детерминированные реплики с контролируемыми вариантами контекста. `runs=3` означает фактические три прогона; `independent=false`, потому что это не независимые внешние наблюдения. В release test эффект проходит, если значимый знак наблюдается минимум в двух из трёх реплик.
