# Neuro-Kurisu 34.95.0 — BIG PASS 121

## Meta-Developmental Learning Allocation

BIG PASS 121 добавляет мета-уровень, который отвечает не только за `что делать`, но и за `чему учиться сейчас`.

### Основные изменения

- `MetaDevelopmentalStrategyEngine` координирует существующие goal / executive / synthesis / self-development слои без создания второго хранилища целей или навыков.
- Активные цели ранжируются по expected learning, uncertainty, novelty, transfer potential, identity fit, developmental fit и resource fit.
- Формируются и проверяются meta-strategy candidates.
- Поддержана cross-goal и cross-macro abstraction.
- Promotion требует verified evidence и разнообразия контекстов.
- Повторные неудачи блокируют стратегию и создают rollback signal.
- Выбранный learning focus и preferred action получают bounded influence на decision scoring.
- Meta-learning pressure передаётся в P53 только как proposal pressure; identity firewall и governance сохраняются.
- Добавлена persistence, migration и runtime diagnostics API.

### Regression

- `BIG_PASS_116=PASS`
- `BIG_PASS_117=PASS`
- `BIG_PASS_118=PASS`
- `BIG_PASS_119=PASS`
- `BIG_PASS_120=PASS`
- `BIG_PASS_121=PASS`
- `TYPECHECK=PASS`

### Evidence boundary

Сигналы meta-learning являются инженерными показателями обучения и выбора curriculum. Они не являются доказательством субъективного сознания.

### Следующий крупный барьер

Замкнуть meta-strategy на реальные длительные сенсорные и социальные кампании, а затем проверять, создаёт ли переносимый curriculum устойчиво новые навыки в независимых задачах без деградации старых способностей.
