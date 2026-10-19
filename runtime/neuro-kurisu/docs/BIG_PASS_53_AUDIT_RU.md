# BIG PASS 53 — Perceptual Grounding

## Главный результат
P41 уже умел хранить entities/relations/events и отдельно native/temporal projections. В этом проходе добавлен единый `PerceptualEvidenceCompiler`, который связывает эти проекции в один bounded provenance layer.

## Реально изменено
- единый perceptual evidence state с `confidence01`, `uncertainty01`, `kind`, `modality`, `parents`;
- active perception request поднимается в единый summary;
- повторяющиеся claims дедуплицируются между циклами;
- persistence нового слоя ограничена: derived evidence materialize-ится не каждый цикл;
- `/api/organism/perception` отдаёт semantic/evidence summaries;
- camera capture получил opt-in `retain`; default cleanup сохранён;
- release/source-of-truth переведён на 34.24.0.

## Научная честность
`model-output`, `derived` и `observed` различаются. Наличие модели, которая вернула объект `person`, не считается независимым подтверждением факта «person существует». Evidence layer не повышает epistemic status автоматически.

## Телефон
- максимум 96 evidence records;
- bounded parent links;
- raw camera artifacts не пишутся в память по умолчанию;
- retained camera file требует явного `retain=true`;
- 500-cycle p95 остаётся около 43 ms в текущем host benchmark;
- 1000-cycle operational gate проходит.

## Что ещё не решено
- нет встроенной полноценной neural vision/audio модели;
- semantic P41 должен получать результат от локального или внешнего backend;
- нет доказательства human-level scene understanding;
- object/relation labels всё ещё зависят от upstream semantic source.
