# BIG PASS 337 — Decision / Action Pipeline Extraction

Дата: 14 сентября 2026

## Почему B337
Перепроверка B336 показала, что project contribution был ручным bias внутри `OrganismCore`, а сам Core остаётся главным scalability bottleneck. B337 не добавляет новую cognitive subsystem. Он выделяет существующее ранжирование/lesion trace в отдельный `DecisionActionPipeline`, чтобы уменьшить ownership Core и получить единый seam для дальнейшего обучения и наблюдаемости.

## Реальное изменение
Добавлен:
`src/organism/core/DecisionActionPipeline.ts`

Pipeline владеет:
- ranking candidate actions;
- top-action extraction;
- full vs ablated comparison;
- lesion-change predicate.

`OrganismCore` теперь передаёт candidate set и causal trace через этот seam. Existing behaviour формально сохраняется; новый pipeline не меняет scoring coefficients.

## Проверки
- `npm run typecheck` — PASS.
- `npm run audit:core-ownership` — PASS, errors=0.
- B336 unit causal ownership — PASS.
- B333 regression — PASS.
- B334 long lifecycle regression — TIMEOUT / OPEN; timeout не считается PASS.

## Что это даёт
B337 — первый структурный шаг из roadmap Phase 2: Decision/Action Pipeline перестаёт быть только внутренним куском `OrganismCore`. Это подготавливает возможность отдельно тестировать и обучать action-selection substrate.

## Что B337 не доказывает
- не доказывает causal learning;
- не доказывает autonomous life;
- не делает project contribution learned;
- не закрывает Android;
- не доказывает consciousness.

## Progress
Общий project progress остаётся около 73%. B337 оценивается как архитектурный enabling step, без процентного бонуса за количество строк.

## Следующий шаг
Сделать короткий воспроизводимый Core cycle через новый seam и затем продолжить extraction следующих boundaries (`Evidence Gateway`, `Self Projection`, `Lifecycle/Persistence`) только после preservation of behaviour.
