# NeuroCore — research admission policy

## Pipeline

`DISCOVER → SOURCE/LICENCE AUDIT → ISOLATE → ADAPT → QUALIFY → PROMOTE / REJECT`

## Source reuse first

Если published implementation уже существует, сначала изучаем и по возможности используем upstream напрямую. Собственная реализация допускается, когда:

- upstream требует несовместимую инфраструктуру;
- лицензия не допускает нужный способ использования;
- нужен компактный mobile/CPU path;
- или нужен исследовательский механизм, которого upstream не предоставляет.

## Qualification gate

Минимум:

- deterministic shape/forward check;
- backward/gradient flow;
- matched parameter/state budget;
- multiple seeds;
- task-specific metric;
- ablation;
- resource measurement;
- provenance + license record.

Для memory-like backends обязательно отдельно измеряются interference, long-horizon recall, forgetting/recovery.

## Anti-duplication

Один canonical owner на память и один canonical owner на recurrent state. Upstream adapters не могут зарегистрировать второй источник истины.

## Current cleanliness

Новый pass не должен добавлять обязательный VXX subclass или новый import side effect в `neurocore`.
