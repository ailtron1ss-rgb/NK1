# Neuro-Kurisu B315 — Contextual Scar + Long-Horizon Recovery

Дата: 14 сентября 2026

## Source of truth
B315 продолжает правило проекта: свежие executable tests имеют приоритет над историческими audit documents. B315 не создаёт новый memory owner: scar остаётся частью canonical B285 Neural Life Consolidation.

## Что изменено
B285 получил bounded context-aware scar state. Для каждого verified negative experience система может сохранить контекстную запись `negative01/recovery01/count/lastTick`. При выборе действия используется ближайший verified scar context с bounded transfer weights: exact=1.0, neighbor=0.55, second neighbor=0.18. Глобальный scar остаётся отдельным защитным сигналом.

B315 также проверяет длительную эволюцию и восстановление без socket/runtime transport overhead: 40 прямых B285 evolution steps, 32 verified corrective events, затем bounded neighbor-context query. Дополнительно существует короткий live OrganismCore smoke, чтобы подтвердить реальную интеграцию.

## Доказательства
- Long-horizon negative outcomes: 40
- Long-horizon recovery events: 32
- Scar before recovery: 0.835623
- Scar after recovery: 0.136432
- Recovery count: 32
- Exact context scar state: meaningful
- Source-context action bias: -0.034452
- Neighbor-context action bias: -0.033897
- Live OrganismCore: 8 verified negative outcomes
- Live OrganismCore context states: 3
- Migration preserves contextual scar state: PASS
- Typecheck: PASS

## Что это означает простыми словами
Плохой подтверждённый опыт теперь может оставить не только общий след, но и частично привязывать предупреждение к похожей ситуации. Последующие хорошие доказательства постепенно ослабляют этот след. Это не полноценная человеческая память и не сознание; это управляемый computational mechanism для долговременной стабильности/пластичности.

## Нейронная проверка
B315 не заменяет B296. Предыдущий B298 closed-loop остаётся reference evidence: 36 learning updates, 5616 synaptic updates, 71 learned world transitions, 3 dreams, lesion и restore. B315 меняет только B285 autobiographical consolidation boundary.

## Ограничение harness
Длинные runtime tests с полным OrganismCore иногда превышают cumulative resource/time budget из-за socket/transport cleanup. Поэтому B315 long-horizon primary evidence намеренно исполняется напрямую через canonical B285 owner, а live OrganismCore integration проверяется отдельным коротким smoke. Это не маскируется как Android hardware evidence.

## Следующий bottleneck
Нужно проверить cross-context scar recovery на более длинной автономной траектории и на реальном Android/Termux, а затем связать scar recovery с фактическим long-horizon action distribution без создания новой памяти.
