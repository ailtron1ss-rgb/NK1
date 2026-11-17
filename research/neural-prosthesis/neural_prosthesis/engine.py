from __future__ import annotations

import contextvars
import hashlib
import json
import math
import os
import re
import tempfile
import weakref
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Sequence

import torch
from torch import nn
from torch.nn import functional as F
from safetensors.torch import load_file, save_file

SCHEMA_VERSION = 1
MAX_TARGET_LAYERS = 8
MAX_BOTTLENECK_SIZE = 512
MAX_MANIFEST_BYTES = 64 * 1024
MAX_WEIGHTS_BYTES = 512 * 1024 * 1024
ADAPTER_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
IMMUTABLE_REVISION = re.compile(r"^(?:[0-9a-f]{40}|sha256:[0-9a-f]{64})$")


class ArtifactError(ValueError):
    """Raised when an adapter or its binding evidence is invalid."""


def _canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ArtifactError(f"duplicate-manifest-key:{key}")
        result[key] = value
    return result


def _model_config(model: nn.Module) -> dict[str, Any]:
    config = getattr(model, "config", None)
    if config is None:
        raise ArtifactError("model-config-missing")
    raw = config.to_dict() if callable(getattr(config, "to_dict", None)) else vars(config)
    if not isinstance(raw, dict):
        raise ArtifactError("model-config-invalid")
    ignored = {"_name_or_path", "_commit_hash", "transformers_version", "torch_dtype"}
    clean = {str(key): value for key, value in raw.items() if key not in ignored}
    try:
        _canonical_json(clean)
    except (TypeError, ValueError) as error:
        raise ArtifactError("model-config-not-canonical-json") from error
    return clean


def _config_digest(config: dict[str, Any]) -> str:
    return _sha256_bytes(_canonical_json(config))


def _hidden_size(config: dict[str, Any]) -> int:
    for key in ("hidden_size", "n_embd", "d_model", "word_embed_proj_dim"):
        value = config.get(key)
        if isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 65536:
            return value
    raise ArtifactError("model-hidden-size-unsupported")


def _resolve_layer_stack(model: nn.Module, layer_path: str) -> Sequence[nn.Module]:
    path = str(layer_path or "").strip()
    if not path or len(path) > 240 or "__" in path:
        raise ArtifactError("layer-path-invalid")
    current: Any = model
    for segment in path.split("."):
        if not segment or segment.startswith("_") or segment.isdigit() or not hasattr(current, segment):
            raise ArtifactError(f"layer-path-not-found:{path}")
        current = getattr(current, segment)
    if not isinstance(current, (nn.ModuleList, list, tuple)):
        raise ArtifactError("layer-path-is-not-a-module-sequence")
    if len(current) == 0 or len(current) > 512 or any(not isinstance(item, nn.Module) for item in current):
        raise ArtifactError("layer-stack-invalid")
    return current


class ResidualBottleneck(nn.Module):
    """Zero-start residual MLP with a hard per-token output-norm bound."""

    def __init__(
        self,
        hidden_size: int,
        bottleneck_size: int,
        *,
        max_residual_ratio: float = 0.25,
        dropout: float = 0.05,
    ) -> None:
        super().__init__()
        self.hidden_size = int(hidden_size)
        self.bottleneck_size = int(bottleneck_size)
        self.max_residual_ratio = float(max_residual_ratio)
        self.norm = nn.LayerNorm(self.hidden_size)
        self.down = nn.Linear(self.hidden_size, self.bottleneck_size)
        self.up = nn.Linear(self.bottleneck_size, self.hidden_size)
        self.dropout = nn.Dropout(float(dropout))
        self.scale = nn.Parameter(torch.tensor(0.1, dtype=torch.float32))
        nn.init.kaiming_uniform_(self.down.weight, a=math.sqrt(5))
        nn.init.zeros_(self.down.bias)
        nn.init.zeros_(self.up.weight)
        nn.init.zeros_(self.up.bias)

    def forward(self, hidden: torch.Tensor) -> torch.Tensor:
        if not isinstance(hidden, torch.Tensor) or hidden.ndim < 2:
            raise ArtifactError("residual-hidden-state-invalid")
        if hidden.shape[-1] != self.hidden_size or not hidden.is_floating_point():
            raise ArtifactError("residual-hidden-size-or-dtype-mismatch")
        original_dtype = hidden.dtype
        base = hidden.float()
        delta = self.up(self.dropout(F.silu(self.down(self.norm(base)))))
        base_norm = torch.linalg.vector_norm(base, dim=-1, keepdim=True).clamp_min(1e-6)
        delta_norm = torch.linalg.vector_norm(delta, dim=-1, keepdim=True).clamp_min(1e-6)
        bound = (base_norm * self.max_residual_ratio / delta_norm).clamp(max=1.0)
        delta = delta * bound * torch.tanh(self.scale)
        return (base + delta).to(dtype=original_dtype)


class NeuralProsthesisBank(nn.Module):
    """Request-scoped residual adapters attached to a host-owned Transformer."""

    def __init__(
        self,
        model: nn.Module,
        *,
        model_id: str,
        model_revision: str,
        layer_path: str,
    ) -> None:
        super().__init__()
        if not isinstance(model, nn.Module):
            raise ArtifactError("model-must-be-a-torch-module")
        self.model_id = str(model_id or "").strip()
        self.model_revision = str(model_revision or "").strip()
        if not self.model_id or len(self.model_id) > 240:
            raise ArtifactError("base-model-id-required")
        if not self.model_revision or len(self.model_revision) > 160:
            raise ArtifactError("immutable-base-model-revision-required")
        self.layer_path = str(layer_path)
        self._config = _model_config(model)
        self.config_sha256 = _config_digest(self._config)
        self.hidden_size = _hidden_size(self._config)
        self._model_ref = weakref.ref(model)
        layer_stack = _resolve_layer_stack(model, self.layer_path)
        self._layer_count = len(layer_stack)
        self.adapters = nn.ModuleDict()
        self._active_adapter: contextvars.ContextVar[str | None] = contextvars.ContextVar(
            f"neural_prosthesis_adapter_{id(self)}", default=None
        )
        self._handles = []
        self._closed = False
        for index, layer in enumerate(_resolve_layer_stack(model, self.layer_path)):
            self._handles.append(layer.register_forward_hook(self._make_hook(index)))

    def _make_hook(self, index: int):
        def apply_residual(_module: nn.Module, _inputs: tuple[Any, ...], output: Any) -> Any:
            adapter_id = self._active_adapter.get()
            if adapter_id is None or adapter_id not in self.adapters:
                return output
            adapter = self.adapters[adapter_id]
            key = f"layer_{index}"
            if key not in adapter:
                return output
            if isinstance(output, torch.Tensor):
                return adapter[key](output)
            if isinstance(output, tuple) and output and isinstance(output[0], torch.Tensor):
                return (adapter[key](output[0]), *output[1:])
            if isinstance(output, list) and output and isinstance(output[0], torch.Tensor):
                return [adapter[key](output[0]), *output[1:]]
            raise ArtifactError(f"unsupported-transformer-layer-output:{index}")
        return apply_residual

    def add_adapter(
        self,
        adapter_id: str,
        *,
        layer_indices: Sequence[int],
        bottleneck_size: int,
        max_residual_ratio: float = 0.25,
        dropout: float = 0.05,
    ) -> str:
        identifier = str(adapter_id or "")
        if not ADAPTER_ID.fullmatch(identifier):
            raise ArtifactError("adapter-id-invalid")
        if identifier in self.adapters:
            raise ArtifactError("adapter-id-already-loaded")
        if not isinstance(layer_indices, (list, tuple)) or not 1 <= len(layer_indices) <= MAX_TARGET_LAYERS:
            raise ArtifactError("adapter-layer-count-out-of-range")
        if any(not isinstance(i, int) or isinstance(i, bool) for i in layer_indices):
            raise ArtifactError("adapter-layer-index-invalid")
        normalized = sorted(set(layer_indices))
        if len(normalized) != len(layer_indices) or any(i < 0 for i in normalized):
            raise ArtifactError("adapter-layer-index-invalid")
        if any(i >= self._layer_count for i in normalized):
            raise ArtifactError("adapter-layer-index-out-of-range")
        if not isinstance(bottleneck_size, int) or isinstance(bottleneck_size, bool) or not 1 <= bottleneck_size <= min(MAX_BOTTLENECK_SIZE, self.hidden_size):
            raise ArtifactError("adapter-bottleneck-size-out-of-range")
        if not math.isfinite(float(max_residual_ratio)) or not 0.01 <= float(max_residual_ratio) <= 0.25:
            raise ArtifactError("adapter-residual-bound-out-of-range")
        if not math.isfinite(float(dropout)) or not 0 <= float(dropout) <= 0.3:
            raise ArtifactError("adapter-dropout-out-of-range")
        modules = nn.ModuleDict({
            f"layer_{index}": ResidualBottleneck(
                self.hidden_size,
                bottleneck_size,
                max_residual_ratio=float(max_residual_ratio),
                dropout=float(dropout),
            )
            for index in normalized
        })
        model = self._model_ref()
        parameter = next(model.parameters(), None) if model is not None else None
        device = parameter.device if parameter is not None else torch.device("cpu")
        modules.to(device=device, dtype=torch.float32)
        self.adapters[identifier] = modules
        return identifier

    @contextmanager
    def activate(self, adapter_id: str | None) -> Iterator[None]:
        if adapter_id is not None and adapter_id not in self.adapters:
            raise ArtifactError("adapter-not-loaded")
        token = self._active_adapter.set(adapter_id)
        try:
            yield
        finally:
            self._active_adapter.reset(token)

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        for handle in self._handles:
            handle.remove()
        self._handles.clear()

    def snapshot(self) -> dict[str, Any]:
        loaded = []
        for adapter_id, modules in self.adapters.items():
            layer_indices = sorted(int(key.removeprefix("layer_")) for key in modules.keys())
            first = next(iter(modules.values()))
            loaded.append({
                "adapter_id": adapter_id,
                "layer_indices": layer_indices,
                "hidden_size": first.hidden_size,
                "bottleneck_size": first.bottleneck_size,
                "max_residual_ratio": first.max_residual_ratio,
            })
        return {
            "schema_version": SCHEMA_VERSION,
            "base_model_id": self.model_id,
            "base_model_revision": self.model_revision,
            "config_sha256": self.config_sha256,
            "layer_path": self.layer_path,
            "loaded_adapters": loaded,
        }

    def save_adapter(self, adapter_id: str, destination: str | Path) -> dict[str, Any]:
        if adapter_id not in self.adapters:
            raise ArtifactError("adapter-not-loaded")
        if not IMMUTABLE_REVISION.fullmatch(self.model_revision):
            raise ArtifactError("adapter-export-requires-immutable-base-model-revision")
        target = Path(destination).expanduser()
        if target.exists():
            raise ArtifactError("adapter-destination-already-exists")
        parent = target.parent.resolve()
        parent.mkdir(parents=True, exist_ok=True)
        modules = self.adapters[adapter_id]
        first = next(iter(modules.values()))
        with tempfile.TemporaryDirectory(prefix=".neural-prosthesis-", dir=parent) as scratch:
            temp_dir = Path(scratch) / "artifact"
            temp_dir.mkdir()
            state = {
                key: tensor.detach().to(device="cpu", dtype=torch.float32).contiguous()
                for key, tensor in modules.state_dict().items()
            }
            if any(not torch.isfinite(tensor).all().item() for tensor in state.values()):
                raise ArtifactError("adapter-export-nonfinite-weights")
            weights_path = temp_dir / "adapter.safetensors"
            save_file(state, str(weights_path))
            manifest: dict[str, Any] = {
                "schema_version": SCHEMA_VERSION,
                "artifact_type": "nk1-neural-prosthesis",
                "adapter_id": adapter_id,
                "base_model_id": self.model_id,
                "base_model_revision": self.model_revision,
                "model_type": str(self._config.get("model_type", "")),
                "config_sha256": self.config_sha256,
                "layer_path": self.layer_path,
                "layer_indices": sorted(int(key.removeprefix("layer_")) for key in modules.keys()),
                "hidden_size": self.hidden_size,
                "bottleneck_size": first.bottleneck_size,
                "max_residual_ratio": first.max_residual_ratio,
                "activation": "silu",
                "weights_file": "adapter.safetensors",
                "weights_sha256": _sha256_file(weights_path),
                "status": "candidate",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            manifest["manifest_sha256"] = _sha256_bytes(_canonical_json(manifest))
            (temp_dir / "manifest.json").write_text(
                json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
            )
            os.replace(temp_dir, target)
        return manifest

    def load_adapter(self, artifact_dir: str | Path) -> str:
        directory = Path(artifact_dir).expanduser().resolve()
        manifest_path = directory / "manifest.json"
        weights_path = directory / "adapter.safetensors"
        if not directory.is_dir() or manifest_path.is_symlink() or weights_path.is_symlink():
            raise ArtifactError("adapter-artifact-path-invalid")
        if not manifest_path.is_file() or manifest_path.stat().st_size > MAX_MANIFEST_BYTES:
            raise ArtifactError("adapter-manifest-missing-or-too-large")
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys)
        except ArtifactError:
            raise
        except Exception as error:
            raise ArtifactError("adapter-manifest-invalid-json") from error
        required = {
            "schema_version", "artifact_type", "adapter_id", "base_model_id",
            "base_model_revision", "model_type", "config_sha256", "layer_path",
            "layer_indices", "hidden_size", "bottleneck_size", "max_residual_ratio",
            "activation", "weights_file", "weights_sha256", "status", "created_at",
            "manifest_sha256",
        }
        if not isinstance(manifest, dict) or set(manifest) != required:
            raise ArtifactError("adapter-manifest-schema-mismatch")
        supplied_hash = manifest.get("manifest_sha256")
        unsigned = {key: value for key, value in manifest.items() if key != "manifest_sha256"}
        if not isinstance(supplied_hash, str) or _sha256_bytes(_canonical_json(unsigned)) != supplied_hash:
            raise ArtifactError("adapter-manifest-digest-mismatch")
        if manifest["schema_version"] != SCHEMA_VERSION or manifest["artifact_type"] != "nk1-neural-prosthesis":
            raise ArtifactError("adapter-artifact-version-unsupported")
        if manifest["status"] not in ("candidate", "evaluated") or manifest["activation"] != "silu":
            raise ArtifactError("adapter-artifact-status-or-activation-invalid")
        if not IMMUTABLE_REVISION.fullmatch(self.model_revision):
            raise ArtifactError("adapter-load-requires-immutable-base-model-revision")
        if manifest["base_model_id"] != self.model_id or manifest["base_model_revision"] != self.model_revision:
            raise ArtifactError("adapter-base-model-revision-mismatch")
        if manifest["config_sha256"] != self.config_sha256 or manifest["hidden_size"] != self.hidden_size:
            raise ArtifactError("adapter-base-model-config-mismatch")
        if manifest["layer_path"] != self.layer_path or manifest["model_type"] != str(self._config.get("model_type", "")):
            raise ArtifactError("adapter-base-model-architecture-mismatch")
        if manifest["weights_file"] != "adapter.safetensors" or not SHA256.fullmatch(str(manifest["weights_sha256"])):
            raise ArtifactError("adapter-weights-manifest-invalid")
        if not weights_path.is_file() or weights_path.stat().st_size > MAX_WEIGHTS_BYTES:
            raise ArtifactError("adapter-weights-missing-or-too-large")
        if _sha256_file(weights_path) != manifest["weights_sha256"]:
            raise ArtifactError("adapter-weights-digest-mismatch")
        adapter_id = str(manifest["adapter_id"])
        self.add_adapter(
            adapter_id,
            layer_indices=manifest["layer_indices"],
            bottleneck_size=manifest["bottleneck_size"],
            max_residual_ratio=manifest["max_residual_ratio"],
            dropout=0.0,
        )
        try:
            state = load_file(str(weights_path), device="cpu")
            if any(not torch.is_floating_point(value) or not torch.isfinite(value).all().item() for value in state.values()):
                raise ArtifactError("adapter-weights-contain-nonfinite-values")
            self.adapters[adapter_id].load_state_dict(state, strict=True)
            model = self._model_ref()
            parameter = next(model.parameters(), None) if model is not None else None
            if parameter is not None:
                self.adapters[adapter_id].to(device=parameter.device, dtype=torch.float32)
        except Exception:
            del self.adapters[adapter_id]
            raise
        return adapter_id
