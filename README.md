# NeuroCore

Основной репозиторий проекта NeuroCore. Рабочая базовая версия на 2026-10-19: **WorkPass64**.

> Статус: implementation-workpass, не production-approved. В этом коммите сохранены отчёты и контрольные суммы; бинарные ZIP-архивы пока не загружены в GitHub.

## Артефакты WorkPass64

| Файл | Размер | SHA-256 |
|---|---:|---|
| Полный архив `NeuroCore_WORKPASS64_2026-10-19.zip` | около 129 MiB | `292f21181b06baeea4b1ba0b0c2d36e2b29bb72057a5f8db504dfae548129d0b` |
| Runtime `NeuroCore_Runtime_WORKPASS64.zip` | около 12 MiB | `5af35b57ca14c7e3f14d214a2efc107ea8b8e10958fdf0e98d4529cc59e3e76b` |

SHA-256 и контрольные суммы отчётов находятся в [NeuroCore_WORKPASS64_SHA256SUMS.txt](NeuroCore_WORKPASS64_SHA256SUMS.txt).

## Результаты WorkPass64

- Fast checks: PASS 10/10 (~21 s).
- Runtime typecheck: PASS.
- Learning-action contribution: проверены 8 unit-сценариев и live ON/OFF ablation.
- Archive manifest: 4,257/4,257 hashes совпали.
- Autonomy regression: 79/80 по существующему критерию.
- Retrieval benchmark: recallDelta=0, promotion=not-promoted.
- Полный deep suite, production UI build и настоящий browser E2E остаются незакрытыми; улучшение качества решений независимыми задачами не доказано.

Подробности: [отчёт WorkPass64](NeuroCore_WORKPASS64_REPORT_RU.md) и [сводка аудита](NeuroCore_WORKPASS64_AUDIT_SUMMARY.json).

## Загрузка большого архива

Полный ZIP превышает стандартный лимит GitHub для обычного файла (100 MB). Не хранить архив как Git blob и не дробить его на сотни текстовых файлов в репозитории. Предпочтительный путь — GitHub Release assets или Git LFS. Если прямой бинарный upload недоступен, архив можно разделить локально на части и передать через поддерживаемый канал; после восстановления обязательно проверить SHA-256 исходного архива.

## Следующая инженерная задача — WorkPass65

Создать независимый paired-seed benchmark: baseline, governance-only, transfer-only и full integration; фиксировать task success, regret, calibration, forgetting, catastrophic failures и resource cost; продвижение только по стабильному улучшению на независимом holdout.
