"""NeuroCore package root.

The root module is deliberately lightweight: importing ``neurocore`` must not eagerly import
historical VXX chains. Use ``neurocore.current``/``neurocore.frontier`` for the current API and
``neurocore.vXX`` for an explicit historical snapshot.
"""
from __future__ import annotations

import importlib
import re
from typing import Any

_CURRENT_EXPORTS = {
    "CURRENT_FRONTIER",
    "CURRENT_ENGINE_VERSION",
    "CurrentConfig",
    "mobile_current_config",
    "NeuroCoreCurrent",
    "OrganismTrainerCurrent",
    "OrganismRuntimeCurrent",
    "RuntimeStateStoreCurrent",
}

__all__ = sorted(_CURRENT_EXPORTS)


def _version_from_name(name: str) -> int | None:
    match = re.search(r"V(\d+)(?:\b|_)", name)
    if match is None:
        match = re.search(r"_v(\d+)(?:\b|_)", name, flags=re.IGNORECASE)
    return int(match.group(1)) if match else None


def __getattr__(name: str) -> Any:
    if name in _CURRENT_EXPORTS:
        module = importlib.import_module(".frontier", __name__)
        return getattr(module, name)
    version = _version_from_name(name)
    if version is None:
        raise AttributeError(name)
    module = importlib.import_module(f".v{version}", __name__)
    try:
        return getattr(module, name)
    except AttributeError as exc:
        raise AttributeError(f"module neurocore has no legacy symbol {name!r}") from exc
