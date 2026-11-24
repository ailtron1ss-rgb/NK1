from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, Any

@dataclass
class HardwareProfile:
    name: str
    ram_gb: float
    cpu_threads: int
    has_gpu: bool = False
    has_npu: bool = False
    target_latency_ms: float = 1500.0
    target_energy_mj: float = 2500.0
    max_model_mb: float = 512.0

PROFILES = {
    "low": HardwareProfile("low", 2.0, 4, False, False, 2500, 4000, 256),
    "medium": HardwareProfile("medium", 4.0, 6, True, True, 1200, 2200, 768),
    "high": HardwareProfile("high", 8.0, 8, True, True, 700, 1800, 1536),
}

def choose_profile(ram_gb: float, has_npu: bool = False) -> HardwareProfile:
    candidates = [p for p in PROFILES.values() if p.ram_gb <= ram_gb]
    p = max(candidates, key=lambda x: x.ram_gb) if candidates else PROFILES["low"]
    if has_npu and p.name == "low":
        p = PROFILES["medium"]
    return p

def budget_to_steps(profile: HardwareProfile, desired: float) -> int:
    scale = profile.target_latency_ms / 1000.0
    return max(1, min(8, int(round(1 + desired * scale * 2))))
