from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, Mapping, Optional, Sequence, Tuple, Any
import math

import torch
from torch import Tensor


DEFAULT_SPECS_V48 = {
    "imu": 6,
    "battery": 1,
    "thermal": 1,
    "cpu_load": 1,
    "memory_pressure": 1,
    "ambient_light": 1,
}


@dataclass
class SensorFrameV48:
    timestamp_ms: int
    sequence_id: int
    channels: Dict[str, Sequence[float]]


@dataclass
class SensorHealthV48:
    received_channels: int
    expected_channels: int
    complete_fraction: float
    fresh_fraction: float
    invalid_channels: int


class PhoneTelemetryAdapterV48:
    """Strict real-sensor ingress for Android-side telemetry.

    This class intentionally does not synthesize missing measurements. Missing or
    stale channels become zeros plus an explicit mask so the neural core can learn
    to distinguish "measured zero" from "not observed".
    """

    def __init__(self, specs: Optional[Mapping[str, int]] = None, max_age_ms: int = 1000):
        self.specs = dict(specs or DEFAULT_SPECS_V48)
        self.max_age_ms = int(max(1, max_age_ms))
        self.values: Dict[str, Tensor] = {}
        self.timestamps: Dict[str, int] = {}
        self.sequence_id: int = 0
        self.last_frame_timestamp_ms: Optional[int] = None
        self.invalid_channels = 0

    @property
    def feature_dim(self) -> int:
        return sum(self.specs.values())

    def _validate_values(self, name: str, values: Sequence[float]) -> Tensor:
        expected = int(self.specs[name])
        if len(values) != expected:
            raise ValueError(f"channel {name!r} expected {expected} values, got {len(values)}")
        t = torch.tensor(list(values), dtype=torch.float32)
        if not torch.isfinite(t).all():
            raise ValueError(f"channel {name!r} contains non-finite values")
        return t

    def ingest(self, frame: SensorFrameV48 | Mapping[str, Any]) -> SensorHealthV48:
        if isinstance(frame, Mapping):
            timestamp_ms = int(frame.get("timestamp_ms", -1))
            sequence_id = int(frame.get("sequence_id", self.sequence_id + 1))
            raw_channels = frame.get("channels") or {}
        else:
            timestamp_ms = int(frame.timestamp_ms)
            sequence_id = int(frame.sequence_id)
            raw_channels = frame.channels
        if timestamp_ms < 0:
            raise ValueError("timestamp_ms must be non-negative")
        self.sequence_id = sequence_id
        self.last_frame_timestamp_ms = timestamp_ms
        for name, values in raw_channels.items():
            if name not in self.specs:
                continue
            try:
                t = self._validate_values(name, values)
            except ValueError:
                self.invalid_channels += 1
                raise
            self.values[name] = t
            self.timestamps[name] = timestamp_ms
        return self.health(timestamp_ms)

    def health(self, now_ms: Optional[int] = None) -> SensorHealthV48:
        now = self.last_frame_timestamp_ms if now_ms is None else int(now_ms)
        if now is None:
            return SensorHealthV48(0, len(self.specs), 0.0, 0.0, self.invalid_channels)
        received = 0
        fresh = 0
        for name in self.specs:
            if name in self.values:
                received += 1
                age = max(0, now - int(self.timestamps[name]))
                if age <= self.max_age_ms:
                    fresh += 1
        expected = len(self.specs)
        return SensorHealthV48(
            received_channels=received,
            expected_channels=expected,
            complete_fraction=received / max(1, expected),
            fresh_fraction=fresh / max(1, expected),
            invalid_channels=self.invalid_channels,
        )

    def vector_and_mask(self, now_ms: Optional[int] = None) -> Tuple[Tensor, Tensor]:
        now = self.last_frame_timestamp_ms if now_ms is None else int(now_ms)
        if now is None:
            now = 0
        vectors = []
        masks = []
        for name, width in self.specs.items():
            value = self.values.get(name, torch.zeros(width, dtype=torch.float32))
            vectors.append(value)
            age = math.inf if name not in self.timestamps else max(0, now - self.timestamps[name])
            valid = float(age <= self.max_age_ms)
            masks.append(torch.full((width,), valid, dtype=torch.float32))
        return torch.cat(vectors), torch.cat(masks)

    def interoception(self, now_ms: Optional[int] = None) -> Tensor:
        vector, mask = self.vector_and_mask(now_ms)
        offsets = {}
        cursor = 0
        for name, width in self.specs.items():
            offsets[name] = (cursor, cursor + width)
            cursor += width
        names = ["battery", "thermal", "cpu_load", "memory_pressure"]
        values = []
        masks = []
        for name in names:
            if name in offsets:
                a,b = offsets[name]
                values.append(vector[a:b]); masks.append(mask[a:b])
        return torch.cat(values + masks)

    def state_dict(self) -> Dict[str, Any]:
        return {
            "specs": dict(self.specs),
            "max_age_ms": self.max_age_ms,
            "values": {k: v.clone() for k,v in self.values.items()},
            "timestamps": dict(self.timestamps),
            "sequence_id": self.sequence_id,
            "last_frame_timestamp_ms": self.last_frame_timestamp_ms,
            "invalid_channels": self.invalid_channels,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.specs = dict(state.get("specs", self.specs))
        self.max_age_ms = int(state.get("max_age_ms", self.max_age_ms))
        self.values = {str(k): torch.as_tensor(v, dtype=torch.float32) for k,v in (state.get("values") or {}).items()}
        self.timestamps = {str(k): int(v) for k,v in (state.get("timestamps") or {}).items()}
        self.sequence_id = int(state.get("sequence_id", 0))
        self.last_frame_timestamp_ms = state.get("last_frame_timestamp_ms")
        self.invalid_channels = int(state.get("invalid_channels", 0))


__all__ = ["DEFAULT_SPECS_V48", "SensorFrameV48", "SensorHealthV48", "PhoneTelemetryAdapterV48"]
