# P2707 — Cascaded Credit Experimental Layer

Дата: 2026-09-20
Релиз: 35.7.7 / P2707

## Цель

Усилить реальную нейронную обучаемость при отложенном outcome без перехода на BPTT и без создания второго neural owner. Экспериментальный слой встраивается непосредственно в `NeuralExperienceBranch` и остаётся полностью ablatable.

## Что внедрено

1. **Cascading eligibility traces**
   - быстрый trace: существующий `edgeEligibility`;
   - средний trace: `cascadeEligibilityMid`;
   - медленный trace: `cascadeEligibilitySlow`;
   - итоговый credit: `0.52*fast + 0.30*mid + 0.18*slow`.
2. **Slow plasticity gate / astrocyte-like gate**
   - `astroGate` на нейрон;
   - использует локальную активность и surprise;
   - подавляет пластичность в стабильном режиме и оставляет её открытой при изменениях.
3. **Adaptive credit mixture**
   - `adaptiveCreditMix01` медленно подстраивается по agreement между baseline credit и online credit и по надёжности latent residual;
   - итоговый mix ограничен, поэтому эксперимент не может бесконтрольно разогнать обучение.
4. **Ablation switch**
   - `setExperimentalLayerEnabled(false)` возвращает обучение к fast eligibility + исходному online-credit mix.
5. **Новые метрики**
   - cascade updates;
   - cascade trace norm;
   - astro gate mean;
   - long-delay credit;
   - adaptive credit mix.

## Почему именно это

ICLR 2026 *Learning From the Past with Cascading Eligibility Traces* показывает, что обычный экспоненциальный trace смешивает события при больших задержках, тогда как каскад state-space traces может сохранять более точную временную информацию на масштабах от секунд до минут. Это особенно соответствует нашей проблеме delayed credit. cite: https://proceedings.iclr.cc/paper_files/paper/2026/hash/e647dad9086b5a4cc136e1d1926cc172-Abstract-Conference.html

Работа AGMP 2026 предлагает другой комплементарный принцип: eligibility traces + broadcast teaching signal + медленный astrocyte-like gate для разделения стабильности и пластичности. Это напрямую соответствует нашей homeostasis/stability ветке и хорошо сочетается с cascade trace, потому что один механизм отвечает за **когда прошлое ещё доступно**, а второй — за **можно ли сейчас менять синапс**. cite: https://pmc.ncbi.nlm.nih.gov/articles/PMC12886396/

BrainTrace 2026 остаётся базовым ориентиром для линейной по времени online-learning архитектуры; P2707 не копирует его compiler/gradient machinery, а добавляет multi-timescale credit поверх уже существующего local substrate. cite: https://www.nature.com/articles/s41467-026-68453-w

Self-normalizing STDP 2026 даёт ещё один перспективный следующий шаг: event-driven local normalization с целевым mean weight. Пока он **не включён автоматически**; сначала нужен отдельный matched ablation, чтобы не смешивать нормализацию с P2707. cite: https://www.sciencedirect.com/science/article/pii/S0925231226008167

Active inference 2026 усиливает другой контур: выбирать действия не только по reward, но и по expected information gain. У нас уже есть active-information/world-model ветка; её лучше соединять с P2707 через качество outcome/credit, а не физически объединять владельцев. cite: https://www.nature.com/articles/s41467-026-77209-5

## Фактический тест

`P2707_CASCADE_EXPERIMENTAL_LAYER=PASS`

Matched 48-cycle delayed-outcome experiment:
- trajectory L1 difference against ablated control: **0.03623**;
- adaptive mix: **0.7287**;
- mean astro gate: **0.7351**;
- cascade norm: **0.0028**.

Это доказывает только то, что слой реально меняет causal learning trajectory и остаётся численно стабильным. Это **не** доказательство превосходства над baseline.

## Factorial benchmark

`P2707_FACTORIAL_LEARNING_BENCHMARK=PASS`

Сравнены одинаковые 96-cycle streams:
A baseline → B online credit → C cascade → D cascade+replay → E cascade+replay/high mix → F cascade+replay/low mix.

Ключевой результат: варианты действительно расходятся по весовым траекториям, replay diversity и внутренним credit metrics, но на данном synthetic benchmark `generalization01` не улучшился (0.125 для B–F против 0.25 у A). Поэтому P2707 пока классифицируется как **экспериментальный механизм, требующий holdout/long-horizon validation**, а не как доказанное улучшение качества.

## Следующий эксперимент

1. CET delay sweep: 1 / 4 / 8 / 16 / 32 / 64 cycles.
2. Отдельно измерить sign-correct credit, forgetting и transfer.
3. Сравнить exponential-only vs cascade-only vs hybrid.
4. Добавить self-normalizing local weight rule как отдельный фактор.
5. Проверить restart equivalence и heap pressure на 250/500 cycles.
6. Только после этого рассматривать promotion из experimental в default research-release path.
