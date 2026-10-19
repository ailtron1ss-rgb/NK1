# Research Review B1701–B2200

Дата: 16 сентября 2026

## Основные направления

### 1. Долговременная память и иерархическая маршрутизация

Современные работы 2026 года по H-MEM, TiMem, MCMA и связанным long-term-memory системам показывают ценность временной/иерархической организации памяти, управляемой консолидации и meta-memory вместо плоского полного retrieval. Эти идеи используются в Neuro-Kurisu как ограниченный mobile-friendly memory fabric.

### 2. World model + selective foresight

WorldEvolver и другие 2026 работы объединяют episodic transitions, semantic memory correction и selective foresight. Ключевой вывод для нашего проекта: world model не должен быть отдельным оракулом; он должен быть вызван адаптивно, сравниваться с наблюдением и иметь verifier.

### 3. Continual learning

Работы по replay, gradient alignment и stability/plasticity показывают, что lifelong learning требует управления тем, что именно вспоминается, когда закрепляется старое знание и как предотвращается catastrophic interference.

### 4. Long-horizon autonomous development

EvolvingAgent и связанные исследования self-evolving agents объединяют planner, controller, reflection, continual world model и curriculum. Для Neuro-Kurisu это аргумент в пользу общего developmental loop вместо независимого роста числа модулей.

### 5. Наш собственный архитектурный вывод

Новые механизмы полезнее внедрять как causally coupled chain:

experience -> durable receipt -> memory -> skill -> world evidence -> policy update -> neural plasticity -> self-model -> curriculum -> next experience.

Именно этот принцип стал основой B1701–B2200.

## Ограничение переноса

Публикуемые benchmark improvements нельзя арифметически переносить на Neuro-Kurisu. Внешние результаты используются как design hypotheses; решающим считается собственный executable evidence и ablation matrix.
