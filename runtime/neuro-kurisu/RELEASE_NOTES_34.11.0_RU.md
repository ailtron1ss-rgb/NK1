# Neuro-Kurisu 34.11.0 — BIG PASS 42

Главный фокус релиза: project execution hardening + lightweight evidence spine.

Изменения:

- Project Executor 2.0: dependencies, retries, failure provenance, tool metrics.
- Project tool execution требует cognitive budget.
- Failed project tools не продвигают шаг и создают retry delay.
- Runtime Evidence Bus получил дешёвые metrics и меньший allocation overhead.
- CognitiveSubsystemFacade получил project budget summary.
- Release/source-of-truth tooling сделан dynamic по VERSION.json.
- State schema: 88.
