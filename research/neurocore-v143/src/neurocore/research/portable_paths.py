"""Portable output-path helpers for NeuroCore V143 research harnesses."""
from __future__ import annotations

import os
from pathlib import Path


def resolve_output_dir(default_root: str | Path) -> Path:
    """Resolve a writable evidence directory without assuming a container mount.

    NK_NEUROCORE_V143_OUTPUT_DIR may point to an absolute or relative path.
    Relative overrides are resolved from the caller's working directory, matching
    normal CLI environment-variable semantics.
    """
    override = os.environ.get("NK_NEUROCORE_V143_OUTPUT_DIR", "").strip()
    candidate = Path(override).expanduser() if override else Path(default_root) / "evidence"
    return candidate.resolve()
