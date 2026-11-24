# P28 — Что взять из Brain v11 и почему

Сравнение с внешним Neuro-Kurisu Brain v11 показало, что его сильнейшая идея — дешёвый local plasticity layer. Внешний прототип использовал prototype memory и eligibility-like traces, но не имел полноценной persistence/migration/runtime/device architecture.

P28 переносит эти идеи только там, где они не конфликтуют с canonical architecture:

- bounded prototype memory;
- global temporal decay eligibility;
- delayed credit assignment;
- positive/negative local associations;
- explicit action binding;
- trust/quarantine learning gate.

Не перенесены как authoritative mechanisms:

- energy = node count;
- random goal switching;
- semantic memory as frequency dictionary;
- identity = action hash;
- non-persistent runtime state.

Главный вывод: внешний Brain v11 лучше использовать как экспериментальный source of mechanisms, а не как замену persistent organism runtime.
