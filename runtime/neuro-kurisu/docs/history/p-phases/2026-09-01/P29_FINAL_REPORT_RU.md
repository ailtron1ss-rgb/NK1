
## Финальная проверка P29

- typecheck: PASS
- P29 governance: PASS
- P29 migration 31→32: PASS
- P29 integration rollback: PASS
- P29 continual-learning ledger: PASS
- Core→P29→feedback→persist/reload: PASS
- P26/P27/P28 regressions: PASS
- server smoke: PASS
- architecture: PASS
- source hygiene: PASS
- forensics: PASS
- legacy integrity: PASS
- project doctor: PASS

Исторический `P18_LONG_HORIZON` остаётся длинным тестом: в среде разработки полный агрегированный audit может превысить лимит выполнения до его достижения, поэтому он не объявляется пройденным только по факту отсутствия ошибки. Сам migration-path P18 отдельно проходит.

## Дополнительная ревизия после regression

Обнаружена и исправлена логическая тонкость: поскольку arbitration вычисляется отдельно для каждого action, общий `lastArbitration` мог относиться к последнему action в списке, а не к реально выбранному. P29 теперь хранит `lastByAction`, а provenance использует arbitration выбранного действия.

Также `learning budget` теперь является фактическим ограничителем силы arbitration и постепенно восстанавливается между циклами.
