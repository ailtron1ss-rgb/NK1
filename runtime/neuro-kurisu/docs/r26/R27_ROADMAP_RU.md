# R27 Roadmap

1. Уточнить hierarchical oracle на 5–8 шагах с внешним holdout, чтобы исключить benchmark-specific reward shape.
2. Добавить causal downstream benchmark для erase/write gates с delayed outcome, а не только immediate readout delta.
3. Исследовать low-rank correction в ранговых режимах 1/2/4 и только при положительном matched gain разрешать canonical promotion.
4. Проверить adaptive replay credit на последствиях memory eviction.
5. Повторить recurrent matched ablation после тех же downstream критериев; promotion только при положительном результате.
6. Реальный 3000+ cycle Android/Termux soak остаётся device-side gate.
