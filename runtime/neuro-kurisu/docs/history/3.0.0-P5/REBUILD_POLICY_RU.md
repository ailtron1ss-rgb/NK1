# Политика пересборки

Старый проект не удалён. Он целиком находится в `legacy-original/` и не является runtime dependency.

Canonical layer намеренно начинается заново с малого числа файлов. Любая новая функция проходит путь:
1. новый canonical module;
2. unit/smoke test;
3. integration test;
4. deterministic replay, если применимо;
5. audit;
6. только затем подключение к runtime.

Новые coordinator/mega/unified layers не разрешаются без отдельного архитектурного ADR.
