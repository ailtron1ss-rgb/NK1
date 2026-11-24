# Release license review — рабочий список

## Повторный точный аудит 2026-11-01

- Проверенная исходная ветка: `workpass70-source`, exact audited SHA `8cf8872ad6005007d1eb1a3b04e82c7f56105c4f`.
- Release workflow: [non-publishing exact-SHA audit run 41286922912](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41286922912); source freshness, SBOM/provenance inventory и non-publishing audit capture прошли; readiness остаётся false только из-за незавершённого human license review.
- Текущий результат: `releaseRedistributionReady=false`, **115 ошибок**.
- Актуальная инвентаризация: 477 locked npm-компонентов; fingerprint `a10f75530eeac185de88cdf338b094c2cbd9bec7a4c16c9cee7b5d040cb92cd4`; 8 source archives; 11 repository LICENSE/NOTICE.
- Разбивка 115 ошибок: global review — 5; root project — 5; runtime project — 5; locked npm inventory — 5; 8 архивов — 40; 11 repository LICENSE/NOTICE — 55.
- Все review-записи остаются `pending`; `redistributionApproved=false`; reviewerType/reviewer/reviewedAt не заполнены. Никаких человеческих одобрений не подставлялось.
- Важное решение владельца: `runtime/neuro-kurisu/LICENSE` содержит private / all rights reserved. Публичное распространение полного runtime нельзя считать разрешённым без явного решения правообладателя.


## Текущий проверенный снимок

- Source SHA: `7dc96bd0dfa612f6b47c37b6add2bc6ba82a33d2`.
- Аудит: [GitHub Actions run 41234198086](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41234198086).
- Результат: fail-closed, 136 ошибок, release redistribution readiness = false.
- Locked npm inventory: 477 компонентов.
- Fingerprint: `a10f75530eeac185de88cdf338b094c2cbd9bec7a4c16c9cee7b5d040cb92cd4`.
- В manifest исправлен count 462 → 477. Fingerprint оставлен null до human review.
- В manifest добавлены evidenceRef и licenseExpression для root/runtime, locked inventory, 8 archives и всех 11 repository LICENSE/NOTICE файлов. Четыре vendor LICENSE получили строки с вычисленными SHA-256.
- Все статусы остаются pending, `redistributionApproved=false`, reviewer-поля пусты. Повторный аудит после этих evidence-only изменений ещё не завершён.

## Историческая сводка аудита 2026-10-31 до evidence-only обновления manifest

| Область | Ошибок | Причина |
|---|---:|---|
| Global release review | 5 | Нет human approval, reviewer и даты |
| Root project | 5 | Нет human approval, reviewer, даты и redistribution permission; licenseExpression/evidenceRef уже заданы |
| Runtime project | 5 | LICENSE private / all rights reserved; human approval и redistribution permission отсутствуют |
| Locked npm inventory | 5 | Human review отсутствует; fingerprint не утверждён и требует сверки после review |
| Source archives | 40 | 8 архивов × 5 отсутствующих approval-полей |
| Repository LICENSE/NOTICE | 55 | 11 записей × 5 отсутствующих approval-полей; все 11 строк есть в manifest, но остаются pending |
| **Всего** | **136** | До повторного аудита после factual count correction |

## Порядок закрытия

1. Владелец проекта принимает решение по root/runtime лицензии и публичному распространению.
2. Проверить 477 locked npm компонентов; после human review записать точный fingerprint и evidenceRef.
3. Для восьми архивов проверить полный состав, вложенные LICENSE/NOTICE, upstream и commit; неизвестные архивы не включать в публичный Release без разрешения.
4. Рассмотреть все 11 repository LICENSE/NOTICE: записи уже присутствуют в manifest, но все остаются pending без human approval.
5. Заполнить review-поля только после реального решения человека.
6. Запустить release audit на актуальном source SHA; публиковать ZIP только при полном успехе всех gates.

Числа выше — исторический снимок 2026-10-31. Точный повторный аудит 2026-11-01 зафиксировал 115 ошибок; см. актуальный блок в начале документа.

Подробные upstream-свидетельства и нерешённые вопросы: [RELEASE_LICENSE_VENDOR_EVIDENCE_2026-10-31_RU.md](RELEASE_LICENSE_VENDOR_EVIDENCE_2026-10-31_RU.md).

## Release

Последний подтверждённый Release остаётся `workpass70-hotfix1-2026-10-19`, asset `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip` (136,354,713 bytes). Новый asset не создан и существующий не заменён.
