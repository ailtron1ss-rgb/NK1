from pathlib import Path
import importlib

from core.nomega.canonical_registry_v1 import CanonicalModuleRegistryV1


def test_every_canonical_target_resolves_to_a_real_symbol():
    registry = CanonicalModuleRegistryV1(Path('.'))
    failures = []
    for family, (module_name, symbol_name) in registry.CANONICAL_TARGETS.items():
        try:
            module = importlib.import_module(f"core.nomega.{module_name}")
            getattr(module, symbol_name)
        except Exception as exc:  # pragma: no cover - failure payload is asserted below
            failures.append((family, module_name, symbol_name, type(exc).__name__, str(exc)))
    assert failures == []
