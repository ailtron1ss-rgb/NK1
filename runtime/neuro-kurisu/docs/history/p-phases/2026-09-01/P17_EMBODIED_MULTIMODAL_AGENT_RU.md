# P17 — Embodied Multimodal Agent

Статус: внедрено в 6.3.0.

## Что сделано

P17 объединяет существующий Android/Termux body, perception, память, WorldModel и action gateway в единый замкнутый контур. Добавлен phone-friendly multimodal fusion без обязательной ML-модели: text/speech/vision/sensor/world события нормализуются в общий журнал наблюдений.

Добавлен bounded bidirectional language loop: LLM получает fused evidence и workspace, возвращает структурированную cognitive proposal; proposal advisory и не может напрямую выбрать или исполнить действие. Core остаётся владельцем agency.

ActionGateway получил registry безопасных инструментов, audit trail и verified execution. По умолчанию деструктивные live tools блокируются в dry-run.

Состояние повышено до schema 20 с миграцией 19→20.

## Что намеренно НЕ заявляется

Камера по-прежнему требует реального vision backend для семантического понимания изображения. Без него capture даёт embodied evidence, но не «зрение». LLM не получает право самостоятельно выполнять произвольные shell-команды. P17 не является доказательством сознания.

## Проверки

`test:p17` проверяет multimodal fusion, structured proposal, tool execution и audit. `test:p17:migration` проверяет schema 19→20.

## Следующая фаза

P18 — long-horizon development/science: persistent multimodal memory consolidation, learned perception upgrades, full 24/72/168h Android Device Gate и строгие longitudinal benchmarks.
