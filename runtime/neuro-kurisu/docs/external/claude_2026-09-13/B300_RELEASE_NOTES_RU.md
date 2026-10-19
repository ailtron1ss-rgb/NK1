# B300 Release Notes

## Изменение
Контекстное развитие личности внутри существующего B299 bridge.

## Практический эффект
Теперь одно действие не обязано получать одну и ту же «черту» во всех обстоятельствах. Например, опыт `respond` в социальном контексте и опыт `respond` в эпистемическом контексте могут обучать разные preference traces.

## Архитектурный принцип
Один personality bridge, четыре контекстных traces, один causal/evidence gate, существующий MultiHypothesisPersonality как верхний интегратор.

## Проверено
Typecheck PASS. B300 direct PASS. B299 live 24-cycle PASS. Migration PASS. Полный release audit после финальных правок ещё требуется.
