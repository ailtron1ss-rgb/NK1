#!/usr/bin/env python3
from __future__ import annotations

"""Probe installed upstream neural layers without modifying the current NeuroCore engine."""

import argparse
import json
import time
from pathlib import Path
import sys

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from neurocore.current.upstream import UpstreamBackendCatalog, inspect_constructor, make_upstream_backend  # noqa: E402


def _safe_constructor_kwargs(spec, hidden: int, heads: int) -> dict[str, object]:
    """Best-effort common kwargs; unsupported constructors are reported, never replaced."""
    info = inspect_constructor(UpstreamBackendCatalog([spec]), spec.key)
    params = set(info.get("parameters", ()))
    values: dict[str, object] = {}
    for name, value in (("hidden_size", hidden), ("d_model", hidden), ("dim", hidden),
                        ("num_heads", heads), ("n_heads", heads), ("head_dim", max(1, hidden // heads)),
                        ("use_short_conv", False), ("use_conv", False), ("mode", "fused_recurrent")):
        if name in params:
            values[name] = value
    return values


def _unwrap(result):
    if isinstance(result, torch.Tensor):
        return result
    if isinstance(result, (tuple, list)) and result and isinstance(result[0], torch.Tensor):
        return result[0]
    if isinstance(result, dict):
        for key in ("hidden_states", "last_hidden_state", "output", "y"):
            if isinstance(result.get(key), torch.Tensor):
                return result[key]
    raise TypeError("unsupported output contract")


def probe(spec, *, hidden: int, heads: int, steps: int) -> dict[str, object]:
    result: dict[str, object] = {"key": spec.key, "family": spec.family, "status": spec.status}
    if spec.status == "research_only":
        result["status"] = "blocked_research_only"
        return result
    if not spec.import_target:
        result["status"] = "source_required"
        return result
    availability = spec.availability()
    result["availability"] = availability
    if not availability.get("available"):
        result["status"] = "unavailable"
        result["reason"] = availability.get("reason", "package not installed")
        return result
    kwargs = _safe_constructor_kwargs(spec, hidden, heads)
    result["constructor_kwargs"] = kwargs
    try:
        module = make_upstream_backend(UpstreamBackendCatalog([spec]), spec.key, **kwargs)
    except Exception as exc:
        result["status"] = "constructor_error"
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result
    params = list(module.parameters()) if hasattr(module, "parameters") else []
    result["parameters"] = sum(int(p.numel()) for p in params)
    x = torch.randn(2, steps, hidden)
    try:
        t0 = time.perf_counter()
        out = _unwrap(module(x))
        wall = time.perf_counter() - t0
        loss = out.float().square().mean()
        loss.backward()
        nonzero = sum(int(p.grad is not None and torch.isfinite(p.grad).all() and p.grad.detach().abs().sum().item() > 0) for p in params)
        result.update({
            "status": "qualified_probe",
            "output_shape": list(out.shape),
            "finite_output": bool(torch.isfinite(out).all()),
            "finite_loss": bool(torch.isfinite(loss)),
            "wall_seconds": wall,
            "gradient_parameter_fraction": nonzero / max(1, len(params)),
            "supports_step": callable(getattr(module, "step", None)),
        })
    except Exception as exc:
        result["status"] = "forward_or_backward_error"
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keys", nargs="*", default=None)
    ap.add_argument("--hidden", type=int, default=16)
    ap.add_argument("--heads", type=int, default=2)
    ap.add_argument("--steps", type=int, default=8)
    ap.add_argument("--output", type=Path, default=None)
    args = ap.parse_args()
    torch.manual_seed(0)
    torch.set_num_threads(1)
    catalog = UpstreamBackendCatalog.default()
    wanted = set(args.keys) if args.keys else {s.key for s in catalog.specs()}
    rows = [probe(s, hidden=args.hidden, heads=args.heads, steps=args.steps) for s in catalog.specs() if s.key in wanted]
    report = {"frontier": 93, "seed": 0, "hidden": args.hidden, "heads": args.heads, "steps": args.steps, "results": rows}
    payload = json.dumps(report, indent=2, ensure_ascii=False)
    print(payload)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
