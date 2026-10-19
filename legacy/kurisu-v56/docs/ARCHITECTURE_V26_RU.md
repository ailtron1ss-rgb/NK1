# Архитектура Neuro-Kurisu v26

## Единый контур

```text
Пользователь
   ↓
ChatView / Voice
   ↓
BrainOrchestrator
   ├── Intent
   ├── NeuroEngine
   ├── CognitiveKernel
   ├── LivingPersona
   ├── Memory retrieval
   ├── ACE
   ├── MiCRo experts
   └── Power Governor
          ↓
     Backend Router
       ├── Cloud
       │    ├── Gemini
       │    ├── Groq
       │    ├── OpenRouter
       │    └── Together
       └── Local
            ├── WebGPU
            └── WASM
                 ↓
             Response
                 ↓
       hygiene / expression
          ↓       ↓
        memory  Live2D/TTS
```

## Почему это лучше старой схемы

Старый проект содержал много независимых «мозгов», часть которых дублировала друг друга. v26 не удаляет все модули механически, потому что некоторые из них полезны как специализированные подсистемы. Вместо этого основной путь теперь строится вокруг одного Orchestrator.

### Что действительно меняется со временем

- эмоциональный вектор;
- relationship state;
- LivingPersona;
- personality tendencies;
- ACE memory;
- cognitive predictions;
- self-improvement skill profile.

### Что не меняется хаотически

- базовые ценности;
- имя и базовый характер;
- правила безопасности;
- структура приложения.

Это предотвращает эффект «каждый новый диалог создаёт другую личность».

## Самоулучшение

Самоулучшение разделено на два уровня:

### Runtime evolution

Без переписывания исходников:

- память;
- привычки;
- черты;
- стиль;
- инициативность;
- маршрутизация.

### Code evolution

Только через контролируемый patch pipeline:

- allowlist;
- backup;
- один фрагмент `find`;
- ограниченный размер патча;
- блокировка опасных конструкций;
- TypeScript test;
- rollback.

## Почему нет огромной локальной модели

Для телефона с 4–6 ГБ RAM выгоднее иметь:

**маленькая локальная модель + хороший persistent cognitive state + сильная cloud model при наличии сети**

вместо постоянного удержания 1–4B модели в памяти.

Qwen3 0.6B ONNX существует и имеет Q4F16 вариант около 648 МБ, однако это уже заметно более тяжёлый локальный режим; он оставлен как экспериментальный вариант, а не как обязательный default. urlQwen3 0.6B ONNXhttps://huggingface.co/onnx-community/Qwen3-0.6B-ONNX
