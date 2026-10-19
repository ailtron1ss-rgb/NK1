# Neuro Kurisu 35.23.0 — P2852

## Основной результат

P2852 добавляет реальную управляемую офлайн-консолидацию поверх P2851, переводит пластичность на три временных масштаба и расширяет функциональные абляционные проверки.

## Изменения

### P2852OfflineConsolidationController

Новый persisted controller выбирает режимы `wake`, `quiet`, `sleepRecent`, `sleepPrior`, `transfer` и распределяет replay budget между недавними, старыми и межконтекстными следами.

### NeuralExperienceBranch v29

Добавлены:

- `offlineConsolidation`;
- `fastPlasticity01`;
- `mediumPlasticity01`;
- `slowPlasticity01`;
- `multiscalePlasticityUpdates`.

Replay стал учитывать возраст памяти и context mismatch при выборе кандидатов.

### Functional ablation matrix

Публичный API `ablationMatrix()` и wrapper `OrganismCore.neuralExperienceBranchAblationMatrix()` проверяют пять разных функциональных каналов и recovery после восстановления.

## Проверенные результаты

`tests/p2852-continual-offline-ablation.mjs`:

- PASS;
- holdout replay: `0.0577425888`;
- holdout no-replay: `0.0584844962`;
- relative gain: `0.0126855391`;
- replay cycles: `48`;
- replay samples: `144`;
- multiscale updates: `144`;
- phase coverage: `wake`, `sleepRecent`, `sleepPrior`;
- persistence: PASS.

`tests/p2852-core-integration.mjs`:

- PASS;
- version `29`;
- offline replay cycles `4` за 32 autonomous steps;
- persisted replay samples `8`;
- persisted multiscale updates `32`.

## Release identity

- application: `35.23.0`
- organismCore: `100.16.0-neural-offline-p2852`
- stateSchema: `216`
- phase: `Stage-109/Offline-Consolidation-Multiscale-Ablation/P2852`

Дополнительная финальная правка P2852: существующий `slowMemoryReadout` усилен в decision path и получает фазозависимую replay-пластичность, максимальную в `sleepPrior`. Это сделано после абляционного теста, который показал, что канал был слишком слабым функционально.
