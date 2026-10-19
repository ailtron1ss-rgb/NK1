# P2760 — Continuum Memory Scheduling / Continuum-Causal-World

## Что внедрено
P2760 расширяет существующий P2750 unified causal/world loop явным расписанием обновлений fast/medium/slow memory и межуровневыми bridge-переходами.

Вместо того чтобы каждый memory band переписывался на каждом outcome, частота теперь зависит от уровня и resource pressure:
- fast: каждый тик;
- medium: обычно каждые 2–3 тика;
- slow: обычно каждые 5–6 тиков;
- при mobile pressure интервалы расширяются до 1/4/8.

При обновлении medium получает ограниченный fast→medium перенос, slow получает medium→slow перенос. Bridge strength зависит от surprise, verification и resource pressure. Это делает многошкальную память не просто разными decay-константами, а разными update-frequency channels.

## Зачем
Идея соответствует Nested Learning / Continuum Multi-Timescale Memory: разные части системы могут обновляться с различными частотами, что разделяет быструю пластичность и медленную консолидацию. Отдельная работа Neural Networks 2026 также использует несколько краткосрочных memory components вместе с долгосрочной памятью для баланса stability/plasticity.

## Интеграция
P2760 влияет на:
1. `memoryConsensus01` через cross-timescale bridge agreement;
2. `learningScale01` через `consolidationPressure01`;
3. replay utility через текущее memory agreement;
4. resource-aware write scheduling;
5. persistence через существующий P2750 snapshot/restore.

## Первичный эксперимент
`P2760_CONTINUUM_MEMORY=PASS`

Нормальный ресурс:
- fast scheduled writes = 960;
- medium = 480;
- slow = 192;
- fast→medium bridge = 0.7004;
- medium→slow bridge = 0.7250;
- consensus = 0.8170;
- learning scale = 1.0079.

Высокое resource pressure:
- slow scheduled writes = 145 против 192 в normal-resource run.

Это подтверждает, что write scheduling реально зависит от нагрузки, а не является только диагностикой.

## Ограничения
Это не доказательство биологической эквивалентности памяти и не доказательство сознания. Это инженерная реализация многошкальной пластичности, которую можно подвергать дальнейшим ablation-тестам.
