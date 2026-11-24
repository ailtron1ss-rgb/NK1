# V121 → V122 frontier

1. Qualify adaptive execution на реальном wall-clock и memory footprint, особенно для крупных batch/sequence.
2. Разобрать long-horizon retention: amplitude collapse, interference и capacity прежде чем увеличивать число memory owners.
3. Исследовать unified sparse-associative memory на базе sparse routing + delta/erase/write dynamics.
4. Сравнить GDN-2 / FG²-GDN / Raven / Sparse Delta Memory идеи через один matched benchmark.
5. Пересмотреть self-supervised target: отделить внутренний bootstrap-target от внешне проверяемого predictive objective.
