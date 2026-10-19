# BRAIN-214 README

B214 замыкает функциональный feedback между `CorticalHierarchyEngine` и `ThalamocorticalGate`.

Главный принцип: cortical precision/error не только меняют confidence; они теперь ограниченно меняют routing/gain конкретных thalamic channels.

Система хранит channel-wise posterior/precision/error history, сохраняет её через OrganismCore и восстанавливает через StateMigrations.

Это computational substrate: не утверждается биологическая эквивалентность человеческому таламусу.
