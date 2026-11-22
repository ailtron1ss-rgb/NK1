#!/usr/bin/env python3
"""Loopback-only HTTP adapter for NeuroCore Neural Evolution 0.4.x.

Run with PYTHONPATH pointing at the extracted NMCN src directory. The server
accepts numeric-only NK1 cycle projections and never receives user text.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict
import json
import math
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

from neurocore_neural_evolution.adaptive_core import FastWeightMemory, OnlineLinearWorldModel
from neurocore_neural_evolution.checkpoint import CheckpointError
from neurocore_neural_evolution.cognitive_kernel import CognitiveSignal
from neurocore_neural_evolution.runtime import NeuroCoreRuntime

MAX_REQUEST_BYTES = 16_384
VECTOR_DIMENSIONS = {"state": 8, "action": 6, "memory_key": 8}
SIGNAL_FIELDS = (
    "signal_id", "payload_ref", "goal_relevance", "novelty",
    "prediction_error", "urgency", "consequence", "risk",
    "uncertainty", "created_at",
)


def _unit(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(float(value))
        and 0.0 <= float(value) <= 1.0
    )


def _validate(payload: Any) -> tuple[CognitiveSignal, list[float], list[float], list[float], bool]:
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        raise ValueError("unsupported request schema")
    tick = payload.get("tick")
    if isinstance(tick, bool) or not isinstance(tick, int) or tick < 0:
        raise ValueError("invalid tick")
    if not isinstance(payload.get("low_power"), bool):
        raise ValueError("invalid low_power")
    vectors: dict[str, list[float]] = {}
    for name, expected in VECTOR_DIMENSIONS.items():
        values = payload.get(name)
        if not isinstance(values, list) or len(values) != expected or not all(_unit(v) for v in values):
            raise ValueError(f"invalid {name} vector")
        vectors[name] = [float(v) for v in values]
    raw_signal = payload.get("signal")
    if not isinstance(raw_signal, dict) or set(raw_signal) != set(SIGNAL_FIELDS):
        raise ValueError("invalid signal fields")
    if raw_signal.get("signal_id") != f"nk1-cycle-{tick}" or raw_signal.get("payload_ref") != f"nk1-cycle:{tick}":
        raise ValueError("invalid signal reference")
    for name in SIGNAL_FIELDS[2:9]:
        if not _unit(raw_signal.get(name)):
            raise ValueError(f"invalid signal {name}")
    created_at = raw_signal.get("created_at")
    if isinstance(created_at, bool) or not isinstance(created_at, (int, float)) or not math.isfinite(float(created_at)) or created_at < 0:
        raise ValueError("invalid signal created_at")
    signal = CognitiveSignal(**raw_signal)
    return signal, vectors["state"], vectors["action"], vectors["memory_key"], payload["low_power"]


def _handler(runtime: NeuroCoreRuntime, checkpoint_dir: Path, checkpoint_every: int):
    calls = {"count": 0}
    class Handler(BaseHTTPRequestHandler):
        server_version = "NMCN-Loopback/0.4"

        def do_POST(self) -> None:  # noqa: N802 - stdlib HTTP handler contract
            if self.path != "/evaluate":
                self.send_error(404)
                return
            try:
                length = int(self.headers.get("Content-Length", "-1"))
                if length < 0 or length > MAX_REQUEST_BYTES:
                    self.send_error(413)
                    return
                payload = json.loads(self.rfile.read(length))
                signal, state, action, memory_key, low_power = _validate(payload)
                runtime.low_power = low_power
                decision = runtime.evaluate(signal, state, action, memory_key)
                calls["count"] += 1
                if calls["count"] % checkpoint_every == 0:
                    try:
                        runtime.save_checkpoint_generation(str(checkpoint_dir), keep=3)
                    except Exception:
                        # Advisory persistence failure must not turn a valid decision into an action failure.
                        print("NMCN checkpoint save failed; current decision remains advisory", flush=True)
                body = json.dumps(asdict(decision), separators=(",", ":"), allow_nan=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
            except (ValueError, TypeError, KeyError, json.JSONDecodeError, OverflowError):
                self.send_error(400, "invalid NMCN request")
            except Exception:
                self.send_error(503, "NMCN evaluation unavailable")

        def log_message(self, fmt: str, *args: Any) -> None:
            # Never log request payloads or signal contents.
            super().log_message(fmt, *args)

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the NMCN 0.4.x loopback sidecar")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--checkpoint-dir", default=str(Path.home() / ".local" / "state" / "neurocore-nmcn"))
    parser.add_argument("--checkpoint-every", type=int, default=8)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    if not 1 <= args.checkpoint_every <= 1000:
        parser.error("--checkpoint-every must be between 1 and 1000")
    checkpoint_dir = Path(args.checkpoint_dir).expanduser()
    runtime = NeuroCoreRuntime(
        memory=FastWeightMemory(dimension=8),
        world_model=OnlineLinearWorldModel(state_dim=8, action_dim=6),
    )
    try:
        restored = runtime.load_latest_checkpoint_generation(str(checkpoint_dir), keep=3)
        print(f"NMCN checkpoint restored generation {restored['generation']}", flush=True)
    except CheckpointError as exc:
        # First boot has no generation; a corrupt journal is surfaced, but the
        # advisory sidecar can still start cold without affecting canonical NK1.
        print(f"NMCN checkpoint unavailable; starting cold: {str(exc)[:180]}", flush=True)
    server = HTTPServer(("127.0.0.1", args.port), _handler(runtime, checkpoint_dir, args.checkpoint_every))
    print(f"NMCN sidecar listening on http://127.0.0.1:{args.port}/evaluate", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            runtime.save_checkpoint_generation(str(checkpoint_dir), keep=3)
        except Exception:
            print("NMCN checkpoint shutdown save failed", flush=True)
        server.server_close()


if __name__ == "__main__":
    main()
