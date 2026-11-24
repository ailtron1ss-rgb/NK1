from __future__ import annotations

from dataclasses import dataclass
import importlib
import inspect
from typing import Any


@dataclass(frozen=True)
class UpstreamSymbolProbe:
    key: str
    module: str
    symbol: str
    available: bool
    importable: bool
    constructable: bool
    reason: str
    signature: str | None = None


def _resolve(module_name: str, symbol: str) -> tuple[Any | None, str | None]:
    try:
        module = importlib.import_module(module_name)
    except Exception as exc:  # source-backed probe must expose import failures, never fall back
        return None, f"import failed: {type(exc).__name__}: {exc}"
    try:
        obj = getattr(module, symbol)
    except AttributeError:
        return None, f"symbol not found: {module_name}:{symbol}"
    return obj, None


def probe_symbol(key: str, module: str, symbol: str) -> UpstreamSymbolProbe:
    obj, reason = _resolve(module, symbol)
    if obj is None:
        return UpstreamSymbolProbe(key, module, symbol, False, False, False, reason or "unavailable")
    try:
        signature = str(inspect.signature(obj))
    except (TypeError, ValueError):
        signature = None
    return UpstreamSymbolProbe(
        key,
        module,
        symbol,
        True,
        True,
        False,
        "resolved; construction requires caller-selected device/runtime settings",
        signature,
    )


def probe_official_mamba3() -> UpstreamSymbolProbe:
    """Probe the official state-spaces Mamba-3 symbol without constructing GPU kernels."""
    return probe_symbol("mamba_official.Mamba3", "mamba_ssm", "Mamba3")


def probe_fla_mamba3() -> UpstreamSymbolProbe:
    """Probe the Flash Linear Attention Mamba-3 export without constructing optional kernels."""
    return probe_symbol("fla.Mamba3", "fla.layers", "Mamba3")


def probe_fla_moba() -> UpstreamSymbolProbe:
    """Probe the FLA MoBA export without claiming a local implementation when absent."""
    return probe_symbol("fla.MoBA", "fla.layers", "MoBA")


def snapshot() -> dict[str, dict[str, Any]]:
    probes = (probe_official_mamba3(), probe_fla_mamba3(), probe_fla_moba())
    return {
        p.key: {
            "module": p.module,
            "symbol": p.symbol,
            "available": p.available,
            "importable": p.importable,
            "constructable": p.constructable,
            "reason": p.reason,
            "signature": p.signature,
        }
        for p in probes
    }
