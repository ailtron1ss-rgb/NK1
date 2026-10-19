from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Optional
import os
import platform
import statistics
import time
from pathlib import Path
import json
import re

import torch
from torch import Tensor, nn

from .mobile_profile import MobileExecutionBudget, MobileTier, MOBILE_TIERS, validate_mobile_budget
from .sequence_backend import state_nbytes


@dataclass(frozen=True)
class MobileDeviceSnapshot:
    """Best-effort, unprivileged device/runtime snapshot.

    Android-specific files are read only when present. Missing measurements are represented as
    null/empty values; there is no synthetic fallback that pretends a sensor exists.
    """

    timestamp_unix: float
    platform: str
    machine: str
    processor: str
    python_version: str
    cpu_count: int
    cpu_max_freq_hz: Optional[int]
    mem_total_bytes: Optional[int]
    cgroup_memory_limit_bytes: Optional[int]
    process_rss_bytes: Optional[int]
    thermal_zones_celsius: dict[str, float]
    battery_percent: Optional[float]
    battery_temp_celsius: Optional[float]
    battery_current_ma: Optional[float]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _read_text(path: Path) -> Optional[str]:
    try:
        return path.read_text(errors="ignore").strip()
    except (OSError, UnicodeError):
        return None


def _read_int(path: Path) -> Optional[int]:
    text = _read_text(path)
    if text is None:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def _proc_rss_bytes() -> Optional[int]:
    status = Path("/proc/self/status")
    text = _read_text(status)
    if text:
        m = re.search(r"^VmRSS:\s+(\d+)\s+kB$", text, flags=re.MULTILINE)
        if m:
            return int(m.group(1)) * 1024
    try:
        pages = int(Path("/proc/self/statm").read_text().split()[1])
        return pages * os.sysconf("SC_PAGE_SIZE")
    except (OSError, IndexError, ValueError):
        return None


def _mem_total_bytes() -> Optional[int]:
    text = _read_text(Path("/proc/meminfo"))
    if not text:
        return None
    m = re.search(r"^MemTotal:\s+(\d+)\s+kB$", text, flags=re.MULTILINE)
    return int(m.group(1)) * 1024 if m else None


def _cgroup_memory_limit() -> Optional[int]:
    candidates = (
        Path("/sys/fs/cgroup/memory.max"),
        Path("/sys/fs/cgroup/memory/memory.limit_in_bytes"),
    )
    for path in candidates:
        value = _read_text(path)
        if not value or value == "max":
            continue
        try:
            parsed = int(value)
        except ValueError:
            continue
        if parsed > 0:
            return parsed
    return None


def _cpu_max_freq() -> Optional[int]:
    freqs: list[int] = []
    for path in Path("/sys/devices/system/cpu").glob("cpu[0-9]*/cpufreq/cpuinfo_max_freq"):
        value = _read_int(path)
        if value and value > 0:
            freqs.append(value * 1000)  # sysfs reports kHz
    return max(freqs) if freqs else None


def _thermal_zones() -> dict[str, float]:
    result: dict[str, float] = {}
    root = Path("/sys/class/thermal")
    for zone in sorted(root.glob("thermal_zone*")):
        typ = _read_text(zone / "type") or zone.name
        raw = _read_int(zone / "temp")
        if raw is None:
            continue
        result[typ] = float(raw) / 1000.0
    return result


def _battery() -> tuple[Optional[float], Optional[float], Optional[float]]:
    root = Path("/sys/class/power_supply")
    capacities: list[float] = []
    temps: list[float] = []
    currents: list[float] = []
    for supply in root.glob("*"):
        typ = (_read_text(supply / "type") or "").lower()
        if typ != "battery" and "capacity" not in {p.name for p in supply.glob("capacity")}:
            continue
        cap = _read_int(supply / "capacity")
        if cap is not None:
            capacities.append(float(cap))
        temp = _read_int(supply / "temp")
        if temp is not None:
            temps.append(float(temp) / 10.0 if abs(temp) > 100 else float(temp))
        cur = _read_int(supply / "current_now")
        if cur is not None:
            currents.append(abs(float(cur)) / 1000.0)
    return (
        statistics.mean(capacities) if capacities else None,
        statistics.mean(temps) if temps else None,
        statistics.mean(currents) if currents else None,
    )


def snapshot_device() -> MobileDeviceSnapshot:
    battery_percent, battery_temp, battery_current = _battery()
    return MobileDeviceSnapshot(
        timestamp_unix=time.time(),
        platform=platform.platform(),
        machine=platform.machine(),
        processor=platform.processor(),
        python_version=platform.python_version(),
        cpu_count=os.cpu_count() or 1,
        cpu_max_freq_hz=_cpu_max_freq(),
        mem_total_bytes=_mem_total_bytes(),
        cgroup_memory_limit_bytes=_cgroup_memory_limit(),
        process_rss_bytes=_proc_rss_bytes(),
        thermal_zones_celsius=_thermal_zones(),
        battery_percent=battery_percent,
        battery_temp_celsius=battery_temp,
        battery_current_ma=battery_current,
    )


@dataclass(frozen=True)
class MobileBenchmarkConfig:
    warmup_tokens: int = 16
    decode_tokens: int = 128
    prefill_tokens: int = 256
    chunk_size: int = 32
    sustained_seconds: float = 3.0
    sample_every_tokens: int = 8

    def __post_init__(self) -> None:
        if min(self.warmup_tokens, self.decode_tokens, self.prefill_tokens, self.chunk_size, self.sample_every_tokens) <= 0:
            raise ValueError("mobile benchmark token/chunk parameters must be positive")
        if self.sustained_seconds <= 0:
            raise ValueError("sustained_seconds must be > 0")


@dataclass(frozen=True)
class MobileBenchmarkResult:
    tier: str
    device: dict[str, Any]
    model_parameters: int
    spine_state_bytes_fp32: int
    runtime_state_bytes_fp32: int
    decode: dict[str, Any]
    prefill: dict[str, Any]
    sustained: dict[str, Any]
    budget_validation: dict[str, Any]
    backend_policy: dict[str, Any]
    quantization: dict[str, Any]
    restart: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _parameter_count(model: nn.Module) -> int:
    return int(sum(p.numel() for p in model.parameters() if p.requires_grad))


def _rss_peak(start_rss: Optional[int], samples: list[Optional[int]]) -> Optional[int]:
    values = [v for v in [start_rss, *samples] if v is not None]
    return max(values) if values else None


def _build_inputs(model: nn.Module, tokens: int, *, device: torch.device, dtype: torch.dtype) -> tuple[Tensor, Tensor]:
    raw = int(model.trunk.cfg.raw_observation_dim)
    goal = int(model.trunk.cfg.goal_dim)
    return torch.randn(1, tokens, raw, device=device, dtype=dtype), torch.randn(1, tokens, goal, device=device, dtype=dtype)


@torch.no_grad()
def benchmark_model(model: nn.Module, *, tier: MobileTier = "mobile", config: MobileBenchmarkConfig | None = None) -> MobileBenchmarkResult:
    """Run host or Android benchmark; missing Android sensors remain explicitly unavailable."""
    cfg = config or MobileBenchmarkConfig()
    model.eval()
    device = next(model.parameters()).device
    dtype = next(model.parameters()).dtype
    tier_budget = MOBILE_TIERS[tier]
    params = _parameter_count(model)
    snapshot_before = snapshot_device()

    # Establish a single stream state for decode so timing includes real recurrent state carry.
    obs_warm, goal_warm = _build_inputs(model, cfg.warmup_tokens, device=device, dtype=dtype)
    model.trunk.reset_state(1, device, dtype)
    warm = model.trunk.forward_sequence(obs_warm, goal_warm)
    state = warm["final_state"]
    prev = warm["final_prev_latent"]
    obs = torch.randn(1, cfg.decode_tokens, model.trunk.cfg.raw_observation_dim, device=device, dtype=dtype)
    goals = torch.randn(1, cfg.decode_tokens, model.trunk.cfg.goal_dim, device=device, dtype=dtype)
    rss_samples: list[Optional[int]] = []
    wall_start = time.perf_counter()
    cpu_start = time.process_time()
    for i in range(cfg.decode_tokens):
        out = model.trunk.forward_step(obs[:, i], goals[:, i], state, prev)
        state = out["state"]
        prev = out["latent"]
        if (i + 1) % cfg.sample_every_tokens == 0 or i == cfg.decode_tokens - 1:
            rss_samples.append(snapshot_device().process_rss_bytes)
    wall = time.perf_counter() - wall_start
    cpu = time.process_time() - cpu_start
    total_runtime_state_bytes = _object_nbytes(model.trunk.runtime_state_dict())
    decode = {
        "tokens": cfg.decode_tokens,
        "wall_seconds": wall,
        "cpu_seconds": cpu,
        "ms_per_token_wall": wall * 1000.0 / cfg.decode_tokens,
        "ms_per_token_cpu": cpu * 1000.0 / cfg.decode_tokens,
        "rss_peak_bytes": _rss_peak(snapshot_before.process_rss_bytes, rss_samples),
        "state_bytes": total_runtime_state_bytes,
        "output_bytes_per_token": int(prev.numel() * prev.element_size()),
    }

    obs_p, goals_p = _build_inputs(model, cfg.prefill_tokens, device=device, dtype=dtype)
    model.trunk.reset_state(1, device, dtype)
    before_prefill = snapshot_device()
    start = time.perf_counter()
    pref = model.trunk.forward_sequence_chunked(obs_p, goals_p, chunk_length=cfg.chunk_size, detach_between_chunks=False)
    elapsed = time.perf_counter() - start
    after_prefill = snapshot_device()
    prefill = {
        "tokens": cfg.prefill_tokens,
        "chunk_size": cfg.chunk_size,
        "wall_seconds": elapsed,
        "ms_per_token_wall": elapsed * 1000.0 / cfg.prefill_tokens,
        "rss_delta_bytes": None if before_prefill.process_rss_bytes is None or after_prefill.process_rss_bytes is None else max(0, after_prefill.process_rss_bytes - before_prefill.process_rss_bytes),
        "rss_after_bytes": after_prefill.process_rss_bytes,
        "state_bytes": int(_object_nbytes(model.trunk.runtime_state_dict())),
    }

    # Sustained decode: this is intentionally wall-clock bounded and samples resource sensors.
    model.trunk.reset_state(1, device, dtype)
    one_obs = obs[:, :1]
    one_goal = goals[:, :1]
    out = model.trunk.forward_step(one_obs[:, 0], one_goal[:, 0], model.trunk.spine.initial_state(1, device, dtype), torch.zeros(1, model.trunk.cfg.latent_dim, device=device, dtype=dtype))
    state, prev = out["state"], out["latent"]
    count = 0
    thermals: list[dict[str, float]] = []
    sustain_start = time.perf_counter()
    sustain_cpu_start = time.process_time()
    next_sample = sustain_start
    while time.perf_counter() - sustain_start < cfg.sustained_seconds:
        o = obs[:, count % cfg.decode_tokens]
        g = goals[:, count % cfg.decode_tokens]
        out = model.trunk.forward_step(o, g, state, prev)
        state, prev = out["state"], out["latent"]
        count += 1
        now = time.perf_counter()
        if now >= next_sample:
            snap = snapshot_device()
            thermals.append(snap.thermal_zones_celsius)
            next_sample = now + max(0.25, cfg.sustained_seconds / 6.0)
    sustain_wall = time.perf_counter() - sustain_start
    sustained = {
        "seconds": sustain_wall,
        "tokens": count,
        "tokens_per_second_wall": count / max(sustain_wall, 1e-9),
        "process_cpu_utilization_fraction_of_one_core": min(1.0, (time.process_time() - sustain_cpu_start) / max(sustain_wall, 1e-9)),
        "process_cpu_utilization_fraction_of_all_visible_cores": (time.process_time() - sustain_cpu_start) / max(sustain_wall * max(1, snapshot_before.cpu_count), 1e-9),
        "ms_per_token_wall": sustain_wall * 1000.0 / max(count, 1),
        "final_state_bytes": state_nbytes(state),
        "thermal_samples": thermals,
        "final_device": snapshot_device().as_dict(),
    }

    # Long-session restart: compare uninterrupted suffix with save/load resume from the same
    # checkpoint. This validates that runtime state is sufficient for mobile process restarts.
    ck_obs, ck_goals = _build_inputs(model, 64, device=device, dtype=dtype)
    full = model.trunk.forward_sequence_chunked(ck_obs, ck_goals, chunk_length=cfg.chunk_size, detach_between_chunks=False)
    split_model = model
    split_model.trunk.reset_state(1, device, dtype)
    first = split_model.trunk.forward_sequence_chunked(ck_obs[:, :32], ck_goals[:, :32], chunk_length=cfg.chunk_size, detach_between_chunks=False)
    checkpoint_runtime = split_model.trunk.runtime_state_dict()
    checkpoint_state = first["final_state"].detach().clone()
    checkpoint_prev = first["final_prev_latent"].detach().clone()
    split_model.trunk.load_runtime_state_dict(checkpoint_runtime)
    resumed = split_model.trunk.forward_sequence(ck_obs[:, 32:], ck_goals[:, 32:], initial_state=checkpoint_state, initial_prev_latent=checkpoint_prev)
    restart_diff = (resumed["latent"] - full["latent"][:, 32:]).float().abs()
    restart = {
        "status": "observed",
        "max_abs_latent_error": float(restart_diff.max().item()),
        "mean_abs_latent_error": float(restart_diff.mean().item()),
        "checkpoint_runtime_state_bytes": int(sum(_object_nbytes(v) for v in checkpoint_runtime.values())),
    }

    backend_policy = android_backend_policy()
    quantization = quantization_audit(model, obs_p[:, : min(16, cfg.prefill_tokens)], goals_p[:, : min(16, cfg.prefill_tokens)])
    budget = validate_mobile_budget(
        batch_size=1,
        tokens=max(cfg.prefill_tokens, cfg.decode_tokens),
        chunk_size=cfg.chunk_size,
        state=total_runtime_state_bytes,
        output_nbytes=int(prev.numel() * prev.element_size()),
        trainable_parameters=params,
        active_frontier_experts=int(getattr(getattr(model.trunk, "frontier_stack", None), "router", None).top_k) if getattr(getattr(model.trunk, "frontier_stack", None), "router", None) is not None else 0,
        budget=tier_budget,
        observed_ms_per_token=float(decode["ms_per_token_wall"]),
    )
    return MobileBenchmarkResult(
        tier=tier,
        device=snapshot_before.as_dict(),
        model_parameters=params,
        spine_state_bytes_fp32=state_nbytes(model.trunk.spine.initial_state(1, device, torch.float32)),
        runtime_state_bytes_fp32=int(total_runtime_state_bytes),
        decode=decode,
        prefill=prefill,
        sustained=sustained,
        budget_validation=budget,
        backend_policy=backend_policy,
        quantization=quantization,
        restart=restart,
    )


def _object_nbytes(value: Any) -> int:
    if torch.is_tensor(value):
        return int(value.numel() * value.element_size())
    if isinstance(value, dict):
        return sum(_object_nbytes(v) for v in value.values())
    if isinstance(value, (tuple, list)):
        return sum(_object_nbytes(v) for v in value)
    return 0


def quantization_audit(model: nn.Module, observations: Tensor, goals: Tensor) -> dict[str, Any]:
    """Run a real, non-default dynamic-int8 Linear experiment on CPU-capable builds.

    It is intentionally an experiment only. A passing numerical check does not imply Android
    deployment readiness; backend/operator coverage must be established separately (e.g. XNNPACK).
    """
    if next(model.parameters()).device.type != "cpu":
        return {"status": "not_run", "reason": "dynamic Linear quantization experiment is host/CPU scoped"}
    import copy
    try:
        quantized = torch.ao.quantization.quantize_dynamic(copy.deepcopy(model).cpu().eval(), {nn.Linear}, dtype=torch.qint8)
    except Exception as exc:
        return {"status": "not_run", "reason": f"quantization conversion failed: {type(exc).__name__}: {exc}"}
    with torch.no_grad():
        ref = model.cpu().eval().trunk.forward_sequence(observations.cpu(), goals.cpu())
        cand = quantized.trunk.forward_sequence(observations.cpu(), goals.cpu())
    deltas = {}
    for key in ("latent", "predictive", "world", "self_prediction"):
        diff = (cand[key] - ref[key]).float()
        abs_diff = diff.abs()
        cos = torch.nn.functional.cosine_similarity(cand[key].float(), ref[key].float(), dim=-1)
        deltas[key] = {
            "max_abs": float(abs_diff.max().item()),
            "mean_abs": float(abs_diff.mean().item()),
            "mean_cosine": float(cos.mean().item()),
        }
    ref_bytes = _object_nbytes(model.state_dict())
    q_bytes = _object_nbytes(quantized.state_dict())
    with torch.no_grad():
        t0 = time.perf_counter()
        for _ in range(8):
            quantized.trunk.forward_sequence(observations.cpu(), goals.cpu())
        q_elapsed = time.perf_counter() - t0
        t1 = time.perf_counter()
        for _ in range(8):
            model.trunk.forward_sequence(observations.cpu(), goals.cpu())
        ref_elapsed = time.perf_counter() - t1
    return {
        "status": "observed",
        "scheme": "dynamic_int8_linear",
        "float_state_dict_bytes": int(ref_bytes),
        "quantized_state_dict_bytes": int(q_bytes),
        "state_dict_bytes_ratio": float(q_bytes / max(ref_bytes, 1)),
        "deltas": deltas,
        "reference_8x_seconds": float(ref_elapsed),
        "quantized_8x_seconds": float(q_elapsed),
        "speed_ratio_quantized_over_reference": float(q_elapsed / max(ref_elapsed, 1e-9)),
        "default_enabled": False,
    }


def android_backend_policy() -> dict[str, Any]:
    """Explicit Android backend policy; unsupported paths never silently downgrade."""
    return {
        "default": "executorch_xnnpack",
        "backends": {
            "executorch_xnnpack": {"status": "recommended_cpu", "integrated_in_neurocore": False, "fallback": None},
            "executorch_qualcomm_ai_engine": {"status": "opt_in_external", "integrated_in_neurocore": False, "fallback": None},
            "executorch_mediatek_neuropilot": {"status": "opt_in_external", "integrated_in_neurocore": False, "fallback": None},
            "executorch_vulkan": {"status": "opt_in_external", "integrated_in_neurocore": False, "fallback": None},
            "nnapi": {"status": "rejected_deprecated", "integrated_in_neurocore": False, "fallback": None},
        },
        "contract": "explicit_backend_selection_only",
    }


def export_benchmark_json(result: MobileBenchmarkResult, path: str | os.PathLike[str]) -> None:
    Path(path).write_text(json.dumps(result.as_dict(), indent=2, sort_keys=True) + "\n")
