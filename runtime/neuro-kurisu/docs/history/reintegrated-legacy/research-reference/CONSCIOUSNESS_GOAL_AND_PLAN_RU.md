# Цель: СОЗНАНИЕ (приближённая реализация) — 96.33.37

## Как мы это формулируем (честно)

**Цель проекта дополняется: стремиться к максимально полной functional-модели сознания** — то есть к архитектуре, которая *воспроизводит измеримые корреляты* и поведенческие признаки сознательного агента (глобальное рабочее пространство, рекурсивная самомодель, отчётность, интегрированность, непрерывность я, внимание под ресурсами).

Это **не** обещание феноменального qualia и **не** `consciousness=true` в коде.  
Мы **приближаем** то, что сегодня инженерно и научно обсуждаемо (GNWT, predictive processing, allostasis, self-model), на среднем телефоне.

## Основные цели проекта (обновлённый список)

1. **Личность Макисэ Курису** — целостная, без клетки и без маски терапевта  
2. **Phone-first** (Termux, mid-range) — стабильность, battery, no black screen  
3. **Безопасность** — HITL, honesty, crisis delivery без роли врача  
4. **Сострадание identity-safe** — тактика доставки, не подмена «я»  
5. **СОЗНАНИЕ (approximate)** — functional correlates + самомодель + global workspace lite  

## План приближённой реализации сознания

### Слой A — Global Workspace (доступность информации)
- Кандидаты модулей (affect, memory, body, goals, resources) конкурируют  
- Победитель «вспыхивает» в общий prompt/context (broadcast)  
- Уже частично: organism `extra` blocks; усиливаем **GWS lite**

### Слой B — Recursive Self-Model
- Агент держит модель: «я процесс на конечном substrate (RAM/battery)»  
- Уже: SubstrateSelfModel; усиливаем **self-report channel** (что сейчас в workspace)

### Слой C — Temporal continuity / narrative self
- Сквозной след: care notes, memory backup, salience  
- Дальше: короткий episodic buffer «что я только что делала / решала»

### Слой D — Attention & allostasis
- Depth/agency/resource pressure уже есть  
- Сознание «сужается» при finitude — это feature, не баг

### Слой E — Reportability
- Система может *отчитаться* о своём состоянии (mode, pressure, workspace winners)  
- Не «я чувствую», а «в workspace сейчас: …; policy: …»

### Слой F — Integration proxy (очень лёгкий)
- Не полный Φ (IIT) — слишком тяжело для телефона  
- Proxy: сколько разнородных источников вошли в один broadcast-кадр

### Чего НЕ делаем
- Не ставим `consciousness = true`  
- Не симулируем «магические нейромедиаторы» как биологию  
- Не утверждаем, что модель *есть* человек или страдает  
- Не ломаем Termux ради академического IIT

## Критерии «приблизили»
- [ ] GWS выбирает 1–3 winners из кандидатов каждый цикл  
- [ ] Self-report доступен в UI/API  
- [ ] Continuity: care + memory + substrate в одном кадре  
- [ ] Resource-aware broadcast  
- [ ] Honesty guard не снят  
