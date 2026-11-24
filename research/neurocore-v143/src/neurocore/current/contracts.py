from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Optional

from ..version import CURRENT_ENGINE_VERSION, CURRENT_RELEASE_VERSION


CURRENT_SCHEMA_VERSION = 28


@dataclass(frozen=True)
class TargetContract:
    """Explicit shape contract for the current learning API."""

    batch: int
    time: int
    latent_dim: int

    def validate(self, target: Any) -> None:
        shape = tuple(getattr(target, "shape", ()))
        expected = (self.batch, max(0, self.time - 1), self.latent_dim)
        if shape != expected:
            raise ValueError(
                "target_latent_sequence must have shape "
                f"[B,T-1,L] = {expected}; got {shape}"
            )


@dataclass(frozen=True)
class CurrentCheckpointEnvelope:
    schema_version: int = CURRENT_SCHEMA_VERSION
    engine_version: str = CURRENT_ENGINE_VERSION
    source_version: int = CURRENT_RELEASE_VERSION

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "engine_version": self.engine_version,
            "source_version": self.source_version,
        }


def checkpoint_source_version(payload: Mapping[str, Any]) -> Optional[int]:
    for key in (
        "current_neural_version",
        "current_neural_version_v125",  # historical checkpoint key retained for migration-only loading
        "version_v121",
        "source_version",
        "version_v91",
        "version_v90",
        "version_v89",
        "version_v88",
        "version_v87",
        "version_v86",
        "version_v96",
        "version_v95",
        "version_v94",
        "version_v106",
        "version_v119",
        "version_v115",
        "version_v114",
        "version_v113",
        "version_v108",
        "version_v107",
        "version_v105",
        "version_v100",
        "version_v99",
        "version_v98",
    ):
        if key in payload:
            try:
                return int(payload[key])
            except (TypeError, ValueError):
                return None
    return None
