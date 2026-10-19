# B372 — Research context

B372 не копирует внешнюю архитектуру целиком. Используется только инженерно полезный принцип разделения наблюдаемой физической evidence от simulator evidence и прямой causal feedback в embodied loop.

Termux:API официально предоставляет CLI-доступ к Android-функциям и включает отдельные API-команды; текущий официальный репозиторий указывает релиз v0.53.0. https://github.com/termux/termux-api

Практически это поддерживает выбранный контракт проекта:
`Termux command → parsed telemetry → fresh physical evidence → B365 → action → independent post-action measurement`.

Внешний источник не является доказательством того, что конкретный телефон пользователя подключён. Это проверяется только локальным runtime/device evidence.
