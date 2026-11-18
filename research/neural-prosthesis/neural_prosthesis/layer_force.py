from __future__ import annotations

import contextvars
import hashlib
import json
import math
import os
import re
import stat
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, Sequence

import torch
from torch import nn

from .engine import (
    ADAPTER_ID,
    IMMUTABLE_REVISION,
    ArtifactError,
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


class LayerForceError(ArtifactError):
    """Invalid, unsafe, or unauthorized Layer Force configuration."""


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise LayerForceError(f"profile-duplicate-json-key:{key}")
        result[key] = value
    return result


def _read_profile(path: str | Path) -> tuple[dict[str, Any], bytes]:
    supplied = Path(path).expanduser()
    try:
        if any(part.is_symlink() for part in (supplied, *supplied.parents)):
            raise LayerForceError("profile-symlink-not-allowed")
        resolved = supplied.resolve(strict=True)
        descriptor = os.open(str(resolved), os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        try:
            info = os.fstat(descriptor)
            if not stat.S_ISREG(info.st_mode):
                raise LayerForceError("profile-path-not-regular-file")
            if not 0 < info.st_size <= MAX_PROFILE_BYTES:
                raise LayerForceError("profile-file-size-out-of-range")
            chunks = bytearray()
            while len(chunks) <= MAX_PROFILE_BYTES:
                piece = os.read(descriptor, min(65_536, MAX_PROFILE_BYTES + 1 - len(chunks)))
                if not piece:
                    break
                chunks.extend(piece)
        finally:
            os.close(descriptor)
    except LayerForceError:
        raise
    except OSError as error:
        raise LayerForceError("profile-path-invalid") from error

    raw = bytes(chunks)
    if len(raw) > MAX_PROFILE_BYTES:
        raise LayerForceError("profile-file-size-out-of-range")
    try:
        payload = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object)
    except LayerForceError:
        raise
    except Exception as error:
        raise LayerForceError("profile-json-invalid") from error
    if type(payload) is not dict:
        raise LayerForceError("profile-object-required")
    return payload, raw


@dataclass(frozen=True)
class _SteeringLayer:
    direction: torch.Tensor
    strength: float


@dataclass(frozen=True)
class _SteeringProfile:
    profile_id: str
    profile_sha256: str
    layers: dict[int, _SteeringLayer]
    max_delta_ratio: float


class LayerForceBank:
    """Applies host-approved, request-scoped steering vectors to decoder activations."""

    def __init__(
        self,
        model: nn.Module,
        *,
        model_id: str,
        model_revision: str,
        layer_path: str,
    ) -> None:
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

        config = _model_config(model)
        self.config_sha256 = _config_digest(config)
        self.hidden_size = _hidden_size(config)
        self._model = model
        self._layers = _resolve_layer_stack(model, self.layer_path)
        self._profiles: dict[str, _SteeringProfile] = {}
        self._active: contextvars.ContextVar[tuple[str, float] | None] = contextvars.ContextVar(
            f"layer_force_profile_{id(self)}", default=None
        )
        self._handles: dict[int, Any] = {}
        self._hook_lock = threading.RLock()
        self._applied_hook_calls = 0
        self._applied_token_count = 0
        self._precision_fallback_tokens = 0
        self._closed = False

    def load_profile(
        self,
        path: str | Path,
        approved_manifest_digests: Sequence[str],
    ) -> str:
        if self._closed:
            raise LayerForceError("controller-closed")
        if not isinstance(approved_manifest_digests, (list, tuple, set, frozenset)):
            raise LayerForceError("profile-allowlist-invalid")
        if len(approved_manifest_digests) > 128:
            raise LayerForceError("profile-allowlist-invalid")
        allowed: set[str] = set()
        for digest in approved_manifest_digests:
            if not isinstance(digest, str) or not SHA256.fullmatch(digest):
                raise LayerForceError("profile-allowlist-digest-invalid")
            allowed.add(digest)

        profile, raw = _read_profile(path)
        digest = hashlib.sha256(raw).hexdigest()
        if digest not in allowed:
            raise LayerForceError("profile-not-host-approved")

        expected_fields = {"schema_version", "profile_id", "model", "layers", "max_delta_ratio"}
        if set(profile) != expected_fields:
            raise LayerForceError("profile-schema-mismatch")
        if type(profile["schema_version"]) is not int or profile["schema_version"] != PROFILE_SCHEMA_VERSION:
            raise LayerForceError("profile-version-unsupported")

        profile_id = profile["profile_id"]
        if not isinstance(profile_id, str) or not ADAPTER_ID.fullmatch(profile_id):
            raise LayerForceError("profile-id-invalid")
        if profile_id in self._profiles:
            raise LayerForceError("profile-id-already-loaded")

        binding = profile["model"]
        expected_binding = {
            "model_id": self.model_id,
            "model_revision": self.model_revision,
            "config_sha256": self.config_sha256,
            "layer_path": self.layer_path,
            "hidden_size": self.hidden_size,
        }
        if (
            type(binding) is not dict
            or set(binding) != set(expected_binding)
            or any(type(binding[key]) is not type(expected) or binding[key] != expected
                   for key, expected in expected_binding.items())
        ):
            raise LayerForceError("profile-model-binding-mismatch")

        ratio = profile["max_delta_ratio"]
        if (
            isinstance(ratio, bool)
            or not isinstance(ratio, (int, float))
            or not math.isfinite(float(ratio))
            or not 0 < float(ratio) <= MAX_STEERING_RATIO
        ):
            raise LayerForceError("profile-steering-ratio-out-of-range")

        raw_layers = profile["layers"]
        if type(raw_layers) is not list or not 1 <= len(raw_layers) <= MAX_PROFILE_LAYERS:
            raise LayerForceError("profile-layer-count-out-of-range")

        parameter = next(self._model.parameters(), None)
        target_device = parameter.device if parameter is not None else torch.device("cpu")
        normalized_layers: dict[int, _SteeringLayer] = {}
        for item in raw_layers:
            if type(item) is not dict or set(item) != {"index", "direction", "strength"}:
                raise LayerForceError("profile-direction-entry-schema-invalid")
            index = item["index"]
            if type(index) is not int or not 0 <= index < len(self._layers):
                raise LayerForceError("profile-layer-index-out-of-range")
            if index in normalized_layers:
                raise LayerForceError("profile-duplicate-layer-index")
            strength = item["strength"]
            if (
                isinstance(strength, bool)
                or not isinstance(strength, (int, float))
                or not math.isfinite(float(strength))
                or not -1.0 <= float(strength) <= 1.0
            ):
                raise LayerForceError("profile-direction-strength-out-of-range")
            raw_direction = item["direction"]
            if type(raw_direction) is not list or len(raw_direction) != self.hidden_size:
                raise LayerForceError("profile-direction-width-mismatch")
            for value in raw_direction:
                if (
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(float(value))
                    or abs(float(value)) > MAX_DIRECTION_ABS_VALUE
                ):
                    raise LayerForceError("profile-direction-values-invalid")
            direction = torch.tensor(raw_direction, dtype=torch.float32, device=target_device)
            norm = torch.linalg.vector_norm(direction)
            if not torch.isfinite(norm).item() or norm.item() <= 1e-12:
                raise LayerForceError("profile-direction-zero-or-nonfinite")
            normalized_layers[index] = _SteeringLayer(
                direction=direction / norm,
                strength=float(strength),
            )

        # Loading validates and stores a profile but has no model-side effect.
        # Forward hooks are attached only when an operator-selected profile is
        # explicitly activated for a request.
        prepared = _SteeringProfile(
            profile_id=profile_id,
            profile_sha256=digest,
            layers=normalized_layers,
            max_delta_ratio=float(ratio),
        )
        self._profiles[profile_id] = prepared
        return profile_id

    def _steer(self, hidden: torch.Tensor, layer: _SteeringLayer, ratio: float) -> torch.Tensor:
        if hidden.ndim < 2 or hidden.shape[-1] != self.hidden_size or not hidden.is_floating_point():
            raise LayerForceError("activation-hidden-state-shape-invalid")
        base = hidden.float()
        if not torch.isfinite(base).all().item():
            raise LayerForceError("activation-hidden-state-nonfinite")
        token_norm = torch.linalg.vector_norm(base, dim=-1, keepdim=True)
        direction = layer.direction.to(device=base.device, dtype=base.dtype).view(
            *([1] * (base.ndim - 1)), self.hidden_size
        )
        signed_ratio = layer.strength * ratio
        max_delta_norm = token_norm * abs(signed_ratio)
        delta = direction * (token_norm * signed_ratio)

        # The requested bound is defined on the actual tensor consumed by the
        # next model layer, not on the FP32 pre-cast candidate. FP16/BF16
        # rounding can otherwise push the stored activation beyond the cap.
        candidate = (base + delta).to(dtype=hidden.dtype)
        actual_delta_norm = torch.linalg.vector_norm(candidate.float() - base, dim=-1, keepdim=True)
        over_limit = actual_delta_norm > max_delta_norm

        if over_limit.any().item():
            correction = (max_delta_norm / actual_delta_norm.clamp_min(torch.finfo(torch.float32).tiny)).clamp(max=1.0)
            corrected = (base + delta * correction).to(dtype=hidden.dtype)
            corrected_delta_norm = torch.linalg.vector_norm(corrected.float() - base, dim=-1, keepdim=True)
            still_over_limit = corrected_delta_norm > max_delta_norm
            # Some low-precision formats have no representable value inside
            # the remaining interval. In that case preserve the exact baseline
            # for that token instead of violating the hard safety bound.
            fallback = still_over_limit
            self._precision_fallback_tokens += int(fallback.sum().item())
            candidate = torch.where(fallback, hidden, corrected)

        return candidate

    def _steer_output(self, output: Any, layer: _SteeringLayer, ratio: float, index: int) -> Any:
        if isinstance(output, torch.Tensor):
            return self._steer(output, layer, ratio)
        if isinstance(output, tuple) and output and isinstance(output[0], torch.Tensor):
            return (self._steer(output[0], layer, ratio), *output[1:])
        if isinstance(output, list) and output and isinstance(output[0], torch.Tensor):
            return [self._steer(output[0], layer, ratio), *output[1:]]
        raise LayerForceError(f"unsupported-transformer-layer-output:{index}")

    def _make_hook(self, index: int):
        def apply(_module: nn.Module, _inputs: tuple[Any, ...], output: Any) -> Any:
            active = self._active.get()
            if active is None:
                return output
            profile_id, request_strength = active
            profile = self._profiles.get(profile_id)
            layer = profile.layers.get(index) if profile is not None else None
            if layer is None or layer.strength == 0 or request_strength == 0:
                return output
            scaled_layer = _SteeringLayer(layer.direction, layer.strength * request_strength)
            result = self._steer_output(output, scaled_layer, profile.max_delta_ratio, index)
            hidden = result if isinstance(result, torch.Tensor) else result[0]
            self._applied_hook_calls += 1
            self._applied_token_count += hidden.numel() // hidden.shape[-1]
            return result
        return apply

    @contextmanager
    def activate(self, profile_id: str | None, strength: float = 1.0) -> Iterator[None]:
        if self._closed:
            raise LayerForceError("controller-closed")
        if profile_id is None:
            active = None
        else:
            if not isinstance(profile_id, str) or profile_id not in self._profiles:
                raise LayerForceError("profile-not-loaded")
            if (
                isinstance(strength, bool)
                or not isinstance(strength, (int, float))
                or not math.isfinite(float(strength))
                or not -1.0 <= float(strength) <= 1.0
            ):
                raise LayerForceError("steering-strength-out-of-range")
            # Register each selected decoder hook once, on explicit activation.
            # Roll back only hooks created by this attempt if registration fails.
            with self._hook_lock:
                if self._closed:
                    raise LayerForceError("controller-closed")
                profile = self._profiles[profile_id]
                new_handles: dict[int, Any] = {}
                try:
                    for index in profile.layers:
                        if index not in self._handles:
                            new_handles[index] = self._layers[index].register_forward_hook(self._make_hook(index))
                except Exception:
                    for handle in new_handles.values():
                        handle.remove()
                    raise
                self._handles.update(new_handles)
            active = (profile_id, float(strength))
        token = self._active.set(active)
        try:
            yield
        finally:
            self._active.reset(token)

    def snapshot(self) -> dict[str, Any]:
        visible = [
            item for item in self._profiles.values()
            if "\x00" not in item.profile_id
        ]
        return {
            "enabled": bool(visible),
            "loaded_profiles": [
                {
                    "profile_id": item.profile_id,
                    "profile_sha256": item.profile_sha256,
                    "layer_indices": sorted(item.layers),
                    "max_delta_ratio": item.max_delta_ratio,
                }
                for item in sorted(visible, key=lambda value: value.profile_id)
            ],
            "registered_hook_count": len(self._handles),
            "applied_hook_calls": self._applied_hook_calls,
            "applied_token_count": self._applied_token_count,
            "precision_fallback_tokens": self._precision_fallback_tokens,
        }

    def close(self) -> None:
        with self._hook_lock:
            if self._closed:
                return
            self._closed = True
            for handle in self._handles.values():
                handle.remove()
            self._handles.clear()
            self._profiles.clear()
