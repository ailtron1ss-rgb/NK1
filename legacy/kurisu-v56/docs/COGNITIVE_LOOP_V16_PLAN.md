# Kurisu — Cognitive Loop roadmap

## Цель

Следующий этап не должен просто добавлять больше prompt-текста. Нужно превратить v15 в замкнутый когнитивный контур:

```text
world/event
  ↓
perception
  ↓
attention competition
  ↓
global workspace
  ↓
memory + self-model + affect + goals
  ↓
prediction
  ↓
decision
  ↓
action
  ↓
observation of outcome
  ↓
prediction error
  ↓
learning / reconsolidation
  ↓
updated self-model
```

## Уже добавлено в v15 maintenance pass

- `PredictiveLoop.ts`
- prediction trace persistence
- calibration/error tracking
- prediction hint в LLM context
- prediction resolution после ответа
- расширенный локальный model registry
- custom Hugging Face model repository input
- dtype-aware ONNX loading
- Android/Termux documentation

## Следующий этап: v16

### 1. ConsciousFrame

Один компактный объект состояния одного когнитивного шага:

- event
- attention winner
- relevant memory IDs
- current goal
- prediction
- uncertainty
- action
- outcome

Хранить только последние N frames + агрегаты.

### 2. Attention Competition

Каждый кандидат получает:

```text
salience
novelty
urgency
social relevance
goal relevance
prediction error
```

Победитель попадает в workspace.

### 3. Self-model

Разделить:

- capability self
- limitation self
- autobiographical self
- social self
- future self

### 4. Continuity

Каждый новый запуск восстанавливает:

- последнюю цель
- последний focus
- незакрытые обещания
- pending curiosity
- pending reflection

### 5. Offline consolidation

Во время сна/idle:

- deduplicate memories
- rank important episodes
- update knowledge graph
- resolve predictions
- generate hypotheses
- propose safe configuration changes

Не запускать тяжёлую LLM без необходимости.

### 6. Self-improvement sandbox

Только:

```text
observation
→ hypothesis
→ proposed change
→ isolated test
→ benchmark
→ user approval
→ activate
→ rollback
```

Модель никогда не должна напрямую редактировать production-файлы и сразу выполнять изменения.

### 7. Model router

Будущая система должна выбирать модель по:

```text
difficulty
importance
latency budget
battery budget
RAM
thermal state
privacy
```

### 8. GGUF provider

Добавить Termux/llama.cpp backend отдельно от browser/ONNX.

Это даст широкий каталог GGUF и возможность использовать более зрелый CPU/GPU inference path. Не смешивать API ONNX и GGUF.

## Главный принцип

LLM не равна сознанию.

LLM — один из специализированных когнитивных органов.

Личность должна возникать из взаимодействия:

```text
model
+ memory
+ self-model
+ attention
+ goals
+ affect
+ predictions
+ embodiment
+ environment
+ continuity
```

## Что не делать

- не запускать бесконечный hidden reasoning loop;
- не хранить полный chain-of-thought;
- не позволять модели напрямую менять production code;
- не считать эмоциональный JSON доказательством сознания;
- не делать бесконечную память без консолидации;
- не загружать несколько LLM одновременно на среднем Android;
- не путать размер файла модели с её реальным RAM footprint.
