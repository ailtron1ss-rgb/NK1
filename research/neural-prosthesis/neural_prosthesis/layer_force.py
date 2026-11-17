from __future__ import annotations

import contextvars
import hashlib
import json
import math
import os
import re
import stat
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, Sequence

import torch
from torch import nn

from .engine import (
    ADAPTER_ID,
    IMMUTABLE_REVISION,
    _canonical_json,
    _config_digest,
    _hidden_size,
    _model_config,
    _resolve_layer_stack,
)

PROFILE_SCHEMA_VERSION = 1
MAX_PROFILE_BYTES = 2 * 1024 * 1024
MAX_PROFILE_LAYERS = 8
MAX_DIRECTION_ABS_VALUE = 100_000.0
MAX_STEERING_RATIO = 0.10
SHA256 = re.compile(r"^[0-9a-f]{64}$")


class LayerForceError(ValueError):
    """Invalid or unauthorized Layer Force configuration."""


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise LayerForceError(f"duplicate-profile-key:{key}")
        result[key] = value
    return result


def _read_profile(path: str | Path) -> dict[str, Any]:
    supplied = Path(path).expanduser()
    try:
        resolved = supplied.resolve(strict=True)
        if supplied.is_symlink() or not resolved.is_file():
            raise LayerForceError("profile-path-invalid")
        descriptor = os.open(str(resolved), os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        try:
            info = os.fstat(descriptor)
            if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= MAX_PROFILE_BYTES:
                raise LayerForceError("profile-file-size-or-kind-invalid")
            data = bytearray()
            while len(data) <= MAX_PROFILE_BYTES:
                part = os.read(descriptor, min(65_536, MAX_PROFILE_BYTES + 1 - len(data)))
                if not part:
                    break
                data.extend(part)
        finally:
            os.close(descriptor)
    except LayerForceError:
        raise
    except OSError as error:
        raise LayerForceError("profile-path-invalid") from error
    if len(data) > MAX_PROFILE_BYTES:
        raise LayerForceError("profile-file-size-or-kind-invalid")
    try:
        value = json.loads(
            data.decode("utf-8"),
            object_pairs_hook=_unique_object,
            parse_constant=lambda _value: (_ for _ in ()).throw(LayerForceError("profile-nonfinite-json-number")),
        )
    except LayerForceError:
        raise
    except Exception as error:
        raise LayerForceError("profile-json-invalid") from error
    if type(value) is not dict:
        raise LayerForceError("profile-object-required")
    return value


@dataclass(frozen=True)
class _SteeringProfile:
    profile_id: str
    profile_sha256: str
    directions: dict[int, torch.Tensor]
    max_delta_ratio: float


class LayerForceBank:
    """Applies host-approved, request-scoped steering vectors to selected decoder layers."""

    def __init__(self, model: nn.Module, *, model_id: str, model_revision: str, layer_path: str) -> None:
        if not isinstance(model, nn.Module):
            raise LayerForceError("model-must-be-a-torch-module")
        self.model_id = str(model_id or "").strip()
        self.model_revision = str(model_revision or "").strip()
        self.layer_path = str(layer_path or "").strip()
        if not self.model_id or len(self.model_id) > 240:
            raise LayerForceError("base-model-id-required")
        if not IMMUTABLE_REVISION.fullmatch(self.model_revision):
            raise LayerForceError("immutable-base-model-revision-required")
        if not self.layer_path or len(self.layer_path) > 240:
            raise LayerForceError("layer-path-invalid")

        model_config = _model_config(model)
        self.config_sha256 = _config_digest(model_config)
        self.hidden_size = _hidden_size(model_config)
        self._model = model
        self._layers = _resolve_layer_stack(model, self.layer_path)
        self._profiles: dict[str, _SteeringProfile] = {}
        self._active: contextvars.ContextVar[tuple[str, float] | None] = contextvars.ContextVar(
            f"layer_force_profile_{id(self)}", default=None
        )
        self._handles: dict[int, Any] = {}
        self._applied_hook_calls = 0
        self._applied_token_count = 0
        self._closed = False

    def load_profile(self, path: str | Path, approved_manifest_digests: Sequence[str]) -> str:
        if self._closed:
            raise LayerForceError("controller-closed")
        if not isinstance(approved_manifest_digests, (list, tuple, set, frozenset)) or len(approved_manifest_digests) > 128:
            raise LayerForceError("profile-allowlist-invalid")
        allowed: set[str] = set()
        for digest in approved_manifest_digests:
            if not isinstance(digest, str) or not SHA256.fullmatch(digest):
                raise LayerForceError("profile-allowlist-digest-invalid")
            allowed.add(digest)

        profile = _read_profile(path)
        expected_fields = {
            "schema_version", "profile_id", "base_model_id", "base_model_revision",
            "config_sha256", "layer_path", "hidden_size", "max_delta_ratio",
            "layer_directions", "profile_sha256",
        }
        if set(profile) != expected_fields:
            raise LayerForceError("profile-schema-mismatch")

        unsigned = {key: value for key, value in profile.items() if key != "profile_sha256"}
        try:
            actual_digest = hashlib.sha256(_canonical_json(unsigned)).hexdigest()
        except (TypeError, ValueError) as error:
            raise LayerForceError("profile-canonical-json-invalid") from error
        supplied_digest = profile.get("profile_sha256")
        if not isinstance(supplied_digest, str) or not SHA256.fullmatch(supplied_digest) or supplied_digest != actual_digest:
            raise LayerForceError("profile-digest-mismatch")
        if supplied_digest not in allowed:
            raise LayerForceError("profile-not-host-allowlisted")

        if type(profile["schema_version"]) is not int or profile["schema_version"] != PROFILE_SCHEMA_VERSION:
            raise LayerForceError("profile-version-unsupported")
        profile_id = profile["profile_id"]
        if not isinstance(profile_id, str) or not ADAPTER_ID.fullmatch(profile_id):
            raise LayerForceError("profile-id-invalid")
        if profile_id in self._profiles:
            raise LayerForceError("profile-id-already-loaded")
        if profile["base_model_id"] != self.model_id or profile["base_model_revision"] != self.model_revision:
            raise LayerForceError("profile-base-model-binding-mismatch")
        if profile["config_sha256"] != self.config_sha256 or profile["hidden_size"] != self.hidden_size:
            raise LayerForceError("profile-model-config-mismatch")
        if profile["layer_path"] != self.layer_path:
            raise LayerForceError("profile-layer-path-mismatch")

        ratio = profile["max_delta_ratio"]
        if isinstance(ratio, bool) or not isinstance(ratio, (int, float)) or not math.isfinite(float(ratio)) or not 0 < float(ratio) <= MAX_STEERING_RATIO:
            raise LayerForceError("profile-steering-ratio-out-of-range")
        raw_directions = profile["layer_directions"]
        if type(raw_directions) is not dict or not 1 <= len(raw_directions) <= MAX_PROFILE_LAYERS:
            raise LayerForceError("profile-layer-count-out-of-range")

        reference_parameter = next(self._model.parameters(), None)
        target_device = reference_parameter.device if reference_parameter is not None else torch.device("cpu")
        directions: dict[int, torch.Tensor] = {}
        for raw_index, raw_vector in raw_directions.items():
            if not isinstance(raw_index, str) or not re.fullmatch(r"0|[1-9][0-9]*", raw_index):
                raise LayerForceError("profile-layer-index-invalid")
            layer_index = int(raw_index)
            if layer_index >= len(self._layers):
                raise LayerForceError("profile-layer-index-out-of-range")
            if type(raw_vector) is not list or len(raw_vector) != self.hidden_size:
                raise LayerForceError("profile-direction-width-mismatch")
            for value in raw_vector:
                if isinstance(value, bool) or not isinstance(value, (int, float)):
                    raise LayerForceError("profile-direction-values-invalid")
                if not math.isfinite(float(value)) or abs(float(value)) > MAX_DIRECTION_ABS_VALUE:
                    raise LayerForceError("profile-direction-values-invalid")
            vector = torch.tensor(raw_vector, dtype=torch.float32, device=target_device)
            magnitude = torch.linalg.vector_norm(vector)
            if not torch.isfinite(magnitude).item() or magnitude.item() <= 1e-12:
                raise LayerForceError("profile-direction-zero-or-nonfinite")
            directions[layer_index] = vector / magnitude

        self._profiles[profile_id] = _SteeringProfile(
            profile_id=profile_id,
            profile_sha256=supplied_digest,
            directions=directions,
            max_delta_ratio=float(ratio),
        )
        for layer_index in directions:
            if layer_index not in self._handles:
                self._handles[layer_index] = self._layers[layer_index].register_forward_hook(self._create_hook(layer_index))
        return profile_id

    def _steer(self, hidden: torch.Tensor, direction: torch.Tensor, strength: float, max_delta_ratio: float) -> torch.Tensor:
        if hidden.ndim < 2 or hidden.shape[-1] != self.hidden_size or not hidden.is_floating_point():
            raise LayerForceError("activation-hidden-state-shape-invalid")
        base = hidden.float()
        if not torch.isfinite(base).all().item():
            raise LayerForceError("activation-hidden-state-nonfinite")
        token_norm = torch.linalg.vector_norm(base, dim=-1, keepdim=True)
        scaled_direction = direction.to(device=base.device, dtype=base.dtype).view(
            *([1] * (base.ndim - 1)), self.hidden_size
        )
        return (base + scaled_direction * (token_norm * (strength * max_delta_ratio))).to(dtype=hidden.dtype)

    def _steer_output(self, output: Any, direction: torch.Tensor, strength: float, ratio: float, layer_index: int) -> Any:
        if isinstance(output, torch.Tensor):
            return self._steer(output, direction, strength, ratio)
        if isinstance(output, tuple) and output and isinstance(output[0], torch.Tensor):
            return (self._steer(output[0], direction, strength, ratio), *output[1:])
        if isinstance(output, list) and output and isinstance(output[0], torch.Tensor):
            return [self._steer(output[0], direction, strength, ratio), *output[1:]]
        raise LayerForceError(f"unsupported-transformer-layer-output:{layer_index}")

    def _create_hook(self, layer_index: int):
        def apply(_module: nn.Module, _inputs: tuple[Any, ...], output: Any) -> Any:
            active = self._active.get()
            if active is None:
                return output
            profile_id, strength = active
            profile = self._profiles.get(profile_id)
            if profile is None or strength == 0:
                return output
            direction = profile.directions.get(layer_index)
            if direction is None:
                return output
            result = self._steer_output(output, direction, strength, profile.max_delta_ratio, layer_index)
            hidden = result if isinstance(result, torch.Tensor) else result[0]
            self._applied_hook_calls += 1
            self._applied_token_count += hidden.numel() // hidden.shape[-1]
            return result
        return apply

    @contextmanager
    def activate(self, profile_id: str, strength: float = 1.0) -> Iterator[None]:
        if self._closed:
            raise LayerForceError("controller-closed")
        if not isinstance(profile_id, str) or profile_id not in self._profiles:
            raise LayerForceError("profile-not-loaded")
        if isinstance(strength, bool) or not isinstance(strength, (int, float)) or not math.isfinite(float(strength)) or not -1 <= float(strength) <= 1:
            raise LayerForceError("steering-strength-out-of-range")
        token = self._active.set((profile_id, float(strength)))
        try:
            yield
        finally:
            self._active.reset(token)

    def snapshot(self) -> dict[str, Any]:
        return {
            "enabled": bool(self._profiles),
            "loaded_profiles": [
                {
                    "profile_id": item.profile_id,
                    "profile_sha256": item.profile_sha256,
                    "layer_indices": sorted(item.directions),
                    "max_delta_ratio": item.max_delta_ratio,
                }
                for item in sorted(self._profiles.values(), key=lambda value: value.profile_id)
            ],
            "applied_hook_calls": self._applied_hook_calls,
            "applied_token_count": self._applied_token_count,
        }

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        for handle in self._handles.values():
            handle.remove()
        self._handles.clear()
