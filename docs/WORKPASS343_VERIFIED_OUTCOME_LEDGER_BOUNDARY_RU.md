# WorkPass343 — безопасная граница VerifiedOutcomeLedger

**Дата:** 26 октября 2026 г.  
**Ветка:** `work/nk1-workpass335-learning-gate-rebased-2026-10-26-r1`  
**Синхронизированная база:** `22e37b72e20086053d2308d9adf83f18e5828696`  

## Исправленные входные границы

1. Конструктор ledger читает task manifest из собственных data descriptors, а не dereference-ит caller-owned объекты и не копирует их через spread.
2. `record()` сначала строит schema snapshot для outcome и на его основе проверяет task/version/authority/seed/attempt/evidence/time. Getter на поле не исполняется; неизвестные пользовательские свойства не сохраняются в trusted outcome row.
3. `restoreSnapshot()` проверяет data-only top-level envelope и dense arrays до обхода; malformed row/rejection приводит к отказу, а не к чтению через accessor.
4. Signed outcome ingestion переиспользует validated manifest snapshot для lookup, чтобы не вызывать overridable `.find()` на исходном массиве после fingerprint-проверки.
5. Producer skill promotion переводит policy options в descriptor-based snapshot и отклоняет `NaN`, некорректные границы, `null`, методы неправильного типа и accessor configuration вместо незаметного clamp/default.

## Регрессии

- Getter-bearing manifest/outcome/options не выполняют getter body.
- Sparse arrays и array subclasses блокируются на границе.
- Restore snapshot отказывается от getter-bearing envelope и array-index accessor; штатный snapshot round-trip сохраняет accepted/rejected counts.
- Existing signed artifact positive path остаётся валидным; malformed Base64 signatures, envelope/payload getters и неизвестные schema-v1 поля отклоняются.

## Проверка и ограничения

Статус до выполнения CI на объединённом exact HEAD: **PENDING**. Код не объявляется полностью проверенным только на основании исторических успешных runs. Изменение укрепляет целостность данных, но не доказывает рост качества обучения, transfer, retrieval, автономность или production readiness. `main` и release ZIP не менялись.