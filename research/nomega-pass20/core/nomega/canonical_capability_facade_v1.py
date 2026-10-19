from __future__ import annotations

"""Lazy canonical capability facade.

The project has many historical/versioned implementations.  This facade exposes a
small stable set of canonical capabilities while keeping the underlying modules lazy
and independently testable.  It is an integration boundary, not a second runtime.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .canonical_registry_v1 import CanonicalModuleRegistryV1


@dataclass(frozen=True)
class CapabilityHandleV1:
    family: str
    module: str
    symbol: str


class CanonicalCapabilityFacadeV1:
    VERSION = "canonical-capability-facade-v1"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.registry = CanonicalModuleRegistryV1(self.root)

    def resolve(self, family: str) -> CapabilityHandleV1:
        target = self.registry.preferred_target(family)
        if target is None:
            raise KeyError(f"no canonical capability registered for {family!r}")
        return CapabilityHandleV1(str(family), target[0], target[1])

    def load(self, family: str) -> Any:
        handle = self.resolve(family)
        module = __import__(f"core.nomega.{handle.module}", fromlist=[handle.symbol])
        return getattr(module, handle.symbol)

    def factory(self, family: str) -> Callable[..., Any]:
        cls = self.load(family)
        return cls

    def manifest(self) -> dict[str, dict[str, str]]:
        return {
            family: {"module": module, "symbol": symbol}
            for family, (module, symbol) in sorted(self.registry.CANONICAL_TARGETS.items())
        }
