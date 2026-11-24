"""Stable import surface for the canonical current NeuroCore architecture."""
from __future__ import annotations

from .version import CURRENT_ENGINE_VERSION, CURRENT_RELEASE_VERSION
from . import current as _current
from .current import *  # noqa: F401,F403

CURRENT_FRONTIER = CURRENT_RELEASE_VERSION

__all__ = sorted({"CURRENT_FRONTIER", "CURRENT_ENGINE_VERSION", *_current.__all__})
