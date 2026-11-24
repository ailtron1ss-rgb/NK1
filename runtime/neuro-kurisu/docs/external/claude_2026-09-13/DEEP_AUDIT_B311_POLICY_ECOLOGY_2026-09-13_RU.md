# Neuro-Kurisu B311 — глубокий аудит: консолидация policy ecology и verified-context transfer

Дата: 13.09.2026

## 1. Правило истины
B311 продолжает B310 без создания второго policy engine. Истиной считаются свежие executable tests, затем текущие static/release audits. Исторические документы не переписываются задним числом.

## 2. Что B311 исправляет
В B310 было доказано, что policy способен влиять на executive ranking, но несколько policy-like сигналов проходили параллельными путями: AdaptivePolicy, p29/p30 learning arbitration и B264 causal policy. B311 делает их одним canonical `policy` source для B297 executive fusion. Прямые score-вбросы этих ветвей больше не применяются независимо до fusion. Это уменьшает двойной учёт и делает source credit/lesion причинно более интерпретируемыми.

## 3. Verified transfer
AdaptivePolicy получает ограниченное перенесение verified experience на соседние context buckets. Exact context имеет вес 1.0, соседний по одной bucket-координате 0.34, соседний по двум 0.12. Учитываются только строки с verifiedUpdates>=1. Отдельное хранилище не создаётся.

Простым языком: если состояние организма слегка изменилось, проверенный опыт не исчезает полностью.

## 4. Evidence gravity
B297 уже знает source credit. B311 использует его для bounded executive gain только когда policy имеет сильный сигнал и высокий verified credit. Положительный и отрицательный сигнал обрабатываются симметрично.

## 5. Исполнительное доказательство
Отдельный B311 test:
- normal canonical policy choice: `explore`;
- policy lesion choice: `verify`;
- policy source credit после подтверждённых исходов: ~0.8510;
- policy effective weight в изолированном тесте: ~0.7615;
- source count в B297 остаётся 11.

## 6. Доказательство переноса
- verified transfer bias: ~0.007274;
- 1 соседний verified context найден;
- после restore bias остаётся ~0.007274.

Это bounded generalization, а не общий интеллект.

## 7. Регрессии и нейронность
B298 после B311: 36/36 learning updates, 5616 synaptic updates, 71 learned transitions, 3 dreams, restore learningUpdates=36.

B306: 16 eligible autonomous decisions, 11/16 causally influenced, causal influence ~0.6875, causal success ~0.9091.

B305: 32 ticks, 16 full cycles, 8 verified outcomes, 2496 synaptic updates, neural→causal=0.625, causal→personality=0.625, personality→policy=1.0.

## 8. Что пока НЕ доказано
B311 не доказал устойчивый natural whole-organism distribution shift после обучения policy. P6 не закрыт. Android hardware evidence, P7 independent replication и consciousness/subjective experience также не закрыты.

## 9. Простое объяснение
До B311 часть policy-сигналов обучалась параллельно и не имела одного центра исполнительного влияния. Теперь policy-related learning проходит через один canonical executive source. Кроме того, verified policy experience может переноситься в близкий внутренний контекст.

## 10. Текущая шкала
P0 ✅; P1 ✅; P2 ✅; P3 ✅; P4 ✅; P5 ✅ (bounded); P6 🟡; P7 ❌.

Функциональная зрелость: ~66/100. Это инженерная оценка, не процент человеческого мозга.

Consciousness evidence: 2/100.

Verification coverage: 38 VERIFIED / 3757 function-like units; evidenceCoverage ~0.0669.

## 11. Следующий главный вопрос
Не добавлять новый learner. Следующий шаг должен проверить, приводит ли canonical policy ecology к воспроизводимому изменению реального action distribution на нескольких controlled environments, и какие executive sources его подавляют.
