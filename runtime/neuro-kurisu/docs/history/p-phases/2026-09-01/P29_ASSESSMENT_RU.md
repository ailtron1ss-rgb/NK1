# P29 — Assessment

P29 не добавляет ещё один самостоятельный "brain organ". Он вводит control plane над learned-family и тем самым закрывает новый системный bottleneck, появившийся после P26–P28.

Сильные стороны:
- явный arbitration boundary;
- trust-by-source;
- real resource gating;
- provenance;
- continual-learning measurements;
- rollback of previous in-process learned state;
- no runtime dependencies.

Ограничения:
- rollback после полного process restart не восстанавливает старые веса;
- часть heuristic learning остаётся вне arbitration boundary;
- forgetting/retention пока только ledger, без полноценного long-horizon benchmark;
- real phone gate отсутствует в этой среде.

Главный критерий успеха P29: после длительного цикла organism должен сохранять ранее освоенные навыки при обучении новым и уметь объяснить, какой learning source привёл к изменению поведения.
