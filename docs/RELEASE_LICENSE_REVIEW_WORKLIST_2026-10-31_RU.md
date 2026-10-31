# Release license review — рабочий список 2026-10-31

## Текущий проверенный снимок

- Source SHA: `7dc96bd0dfa612f6b47c37b6add2bc6ba82a33d2`.
- Аудит: [GitHub Actions run 41234198086](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41234198086).
- Результат: fail-closed, 136 ошибок, release redistribution readiness = false.
- Locked npm inventory: 477 компонентов.
- Fingerprint: `a10f75530eeac185de88cdf338b094c2cbd9bec7a4c16c9cee7b5d040cb92cd4`.
- В manifest исправлен count 462 → 477. Fingerprint оставлен null до human review.
- В manifest добавлены evidenceRef и licenseExpression для root/runtime, locked inventory, 8 archives и всех 11 repository LICENSE/NOTICE файлов. Четыре vendor LICENSE получили строки с вычисленными SHA-256.
- Все статусы остаются pending, `redistributionApproved=false`, reviewer-поля пусты. Повторный аудит после этих evidence-only изменений ещё не завершён.

## Сводка блокировок последнего аудита до evidence-only обновления manifest

| Область | Ошибок | Причина |
|---|---:|---|
| Global release review | 6 | Нет human approval, reviewer, даты и evidenceRef |
| Root project | 7 | Нет утверждённого license expression и redistribution permission |
| Runtime project | 7 | LICENSE private / all rights reserved; human approval отсутствует |
| Locked npm inventory | 7 до исправления count | 5 полей review + fingerprint + mismatch count; после count=477 mismatch должен исчезнуть, fingerprint остаётся pending |
| Source archives | 56 | 8 архивов × 7 обязательных полей review |
| Repository LICENSE/NOTICE | 53 | В последнем аудите было 7 записей × 7 полей + 4 отсутствующие vendor records; после evidence-only обновления все 11 строк существуют, но review всё ещё pending |
| **Всего** | **136** | До повторного аудита после factual count correction |

## Порядок закрытия

1. Владелец проекта принимает решение по root/runtime лицензии и публичному распространению.
2. Проверить 477 locked npm компонентов; после human review записать точный fingerprint и evidenceRef.
3. Для восьми архивов проверить полный состав, вложенные LICENSE/NOTICE, upstream и commit; неизвестные архивы не включать в публичный Release без разрешения.
4. Разобрать 11 repository LICENSE/NOTICE: 7 pending, 4 vendor записи отсутствуют.
5. Заполнить review-поля только после реального решения человека.
6. Запустить release audit на актуальном source SHA; публиковать ZIP только при полном успехе всех gates.

Эти числа относятся к аудиту до evidence-only обновления manifest; новый точный error count будет зафиксирован только после повторного CI-аудита.

Подробные upstream-свидетельства и нерешённые вопросы: [RELEASE_LICENSE_VENDOR_EVIDENCE_2026-10-31_RU.md](RELEASE_LICENSE_VENDOR_EVIDENCE_2026-10-31_RU.md).

## Release

Последний подтверждённый Release остаётся `NeuroKurisu0.1` / `Neuro`, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` (135,290,615 bytes). Новый asset не создан и существующий не заменён.
