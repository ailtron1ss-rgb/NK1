# B289 Function Reality Policy

Функция считается внедрённой только после evidence.

## Статусы

- UNVERIFIED — наличие кода подтверждено, behavior не доказан.
- PARAMETER_SAFE — параметризованный probe не вызвал ошибки.
- INTEGRATION_ONLY — функция реально вызывается из системы, но direct behavioral contract отсутствует.
- CAUSALLY_VERIFIED — есть intervention/lesion evidence.
- VERIFIED — direct contract + integration + persistence/replay evidence.
- UNSAFE_TO_AUTO_RUN — автоматический probe может менять внешний мир, требует lifecycle/explicit harness.
- DEPRECATED — оставлен только для migration/compatibility.

## Минимальный passport

owner / purpose / inputs / outputs / invariants / side effects / persistence / fixture / direct test / intervention / replay / performance budget.

## Release gate

Нельзя повышать функцию в VERIFIED только потому, что она:

- импортируется;
- компилируется;
- вызывается без exception;
- имеет тест snapshot;
- возвращает объект.

Нужно доказательство ожидаемого поведения.
