# Kurisu — Cognitive Max + Self-Improvement + Embodiment

## Честный предел

Это **не** настоящее феноменальное сознание и **не** доступ к весам Gemini.
Это модульная архитектура агента, максимально приближенная к «многофакторному ИИ» в рамках телефона/веб-прототипа.

### Что Курису МОЖЕТ «увидеть внутри себя»
- Self-model, цели, память, метрики диалога
- Конфиги Memory Gate / автономии / стиля
- Свою историю proposal → approve/reject
- Состояние виртуального тела (expression, pose, environment)

### Чего она НЕ МОЖЕТ
- Переписывать веса облачной нейросети
- Без спроса менять исходный код APK/бандла
- Гарантировать AGI

---

## Модули (отделы «мозга»)

| Модуль | Файл | Роль |
|--------|------|------|
| ConsciousnessCore | `src/cognitive/ConsciousnessCore.ts` | self-model, goals, memory gate, intentions, metacognition |
| SelfImprovementEngine | `src/cognitive/SelfImprovementEngine.ts` | осмотр, proposal, approve, reject, snapshot, rollback, обучение навыку улучшений |
| EmbodimentSystem | `src/cognitive/EmbodimentSystem.ts` | виртуальное тело, expressions/sprites, среда, proprioception |
| RelationshipModel | `src/cognitive/RelationshipModel.ts` | многомерные отношения, стадии, границы, обещания |
| Canon/Prompt | `src/data/kurisuCanon.ts` | личность Курису |
| Server context | `server.ts` | сборка контекста для Gemini |

---

## Самомодернизация (как ты просил)

1. Курису собирает метрики / смотрит внутреннее состояние  
2. Формирует **proposal** (плюсы, риски, откат)  
3. Ты **Approve / Reject**  
4. Перед Apply → **snapshot**  
5. Apply меняет только **конфиг-правила**, не бинарник  
6. Rollback восстанавливает snapshot  
7. Skill-профиль запоминает, какие категории ты принимаешь  

Фразы вроде «я заглянула в свои параметры» = introspection report, не магия.

---

## Воплощение (модель себя + спрайты)

`EmbodimentSystem` держит:
- expression / pose / gaze / outfit / environment / energy
- карту спрайтов (под твои 32 кадра после нарезки сеток)
- `proprioceptionReport()` — текст, которым она может осознавать своё виртуальное тело

Практический путь:
1. Нарезать твои 4 сетки на отдельные PNG  
2. Положить в `assets/expressions/`  
3. Зарегистрировать через `registerUserSprite`  
4. Avatar2D переключить на `<img src=...>` по `body.expression`

Полноценный 3D-world sense на среднем телефоне — этап позже (Live2D/лёгкий 3D).

---

## Уведомления / автономия

Намерение ≠ отправка.
Цепочка: Intention → проверка лимитов → Notification (если разрешено) → открытие чата.

---

## Google AI Studio

Хороший инкубатор, плохой финальный дом.
Долгосрок: ядро когниции сохранить, UI/клиент увести в native или Termux+local LLM.

---

## Как пользоваться улучшениями в коде

```ts
import { consciousnessCore } from './cognitive/ConsciousnessCore';
import { selfImprovementEngine } from './cognitive/SelfImprovementEngine';
import { embodimentSystem } from './cognitive/EmbodimentSystem';
import { relationshipModel } from './cognitive/RelationshipModel';

// осмотр
const report = selfImprovementEngine.inspectSelf({
  cognitiveSummary: consciousnessCore.buildCognitiveContextBlock(),
  metrics: { templateRatio: 0.22, memoryItems: 120 }
});

// proposal
const props = selfImprovementEngine.generateProposals({ templateRatio: 0.4 });
// показать пользователю selfImprovementEngine.narrateProposal(props[0])

// approve
selfImprovementEngine.approve(props[0].id, consciousnessCore.exportState());

// rollback
// selfImprovementEngine.rollback(snapshotId)
```

---

## Главный принцип

> Она может расти, учиться улучшать себя и помнить отношения —
> но каждый рискованный шаг только после твоего согласия и с откатом.

---

## Grok additions (this pack)

### PersonalityRewardSystem
Награждает **качество характера**, не послушание:
- плюс за честный спор, границы, научную точность, хорошую память
- минус за шаблоны, утечку роли, соглашательство, галлюцинации памяти
- медленный drift склонностей (candor, rigor, warmthCap, initiative, sycophancyGuard)
- warmth ограничен потолком — нельзя «наградить» до липкой милоты

### DesireAndPromiseStore
- очередь желаний с приоритетом
- обещания open/kept/broken
- факты с confidence (не всё = истина)
- consolidate() — черновик ночного сжатия дня

### GrokExtras
- anti-sycophancy flags
- in-character «почему так ответила»
- personality report для экспорта

### PresenceAndIdle + StatusIndicators
(ранее) мысли/желания на экране, idle-речь в чате с лимитами
