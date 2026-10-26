# WorkPass376 — строгая проверка времени и текста Hexis evidence

**Дата:** 2026-10-26  
**Ветка:** workpass375-hexis-canonical-ingress-latest  
**Базовый HEAD:** 3e3502842b3891ef64316d9078b1bee7cbd98255  
**Статус:** реализация закоммичена; точные CI-проверки нового HEAD обязательны.

## Дефект

Hexis adapter использовал Date.parse как единственную проверку времени. Парсер может принимать неоднозначные сокращённые строки и нормализовать несуществующие даты. Общий текстовый валидатор запрещал C0/DEL, но пропускал C1 control characters в заметках и метаданных источника.

## Реализация

- Принимать только ISO-8601 timestamp с явной зоной: Z или числовой UTC offset.
- До Date.parse проверять календарный день, час, минуты, секунды и offset; отклонять 30 февраля, некорректный час/offset, локальное время без зоны и неоднозначные значения вроде 0.
- Канонизировать принятое время к UTC с миллисекундной точностью.
- Отклонять C0, DEL и C1 control characters во всех нормализуемых текстах, notes и timestamp.
- Расширить имеющийся тест Hexis adapter/MemoryOS2. Он уже входит в test:hexis-memory-evidence-lineage и path filter Repository Wiring Audit.

## Граница проверки

Предыдущий HEAD WorkPass375 имел 12 успешных Actions workflows, включая Repository Wiring Audit, но ни один из этих результатов не доказывает новый delta. Результаты Actions нового exact HEAD нужно проверить отдельно. Патч не меняет ranking памяти, confidence policy или maturity scores; claims о retrieval uplift, полевой эффективности или production readiness не делаются.

