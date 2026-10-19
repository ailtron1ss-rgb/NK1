# Source-backed upstream workflow

## Главный принцип

Не переписывать уже существующую нейронную математику без необходимости. Сначала использовать upstream source напрямую или через тонкий adapter.

## Поток

`SOURCE → LICENSE → VENDOR → PUBLIC API → PROBE → MATCHED BENCHMARK → ABLATION → PROMOTE/REJECT`

### SOURCE
Исходные байты должны быть локально доступны. Одного README/статьи недостаточно.

### LICENSE
Лицензия записывается в manifest. `NVIDIA Source Code License-NC` остаётся research-only, пока юридические условия не позволяют нужное использование.

### PUBLIC API
Для FLA используется `fla.layers:<Class>` вместо внутренних путей вроде `fla.layers.gdn2:GatedDeltaNet2`: это уменьшает хрупкость при изменении файловой структуры upstream.

### PROBE
Для доступного backend выполняются constructor inspection, forward, finite check, backward и gradient coverage. Ошибки не маскируются fallback-реализацией.

### MATCHED BENCHMARK
Параметрический бюджет, длина последовательности, optimizer и seeds должны быть одинаковыми для сравниваемых backend-ов.

### PROMOTION
Upstream не попадает в current только потому, что он существует или красивее. Promotion требует evidence.
