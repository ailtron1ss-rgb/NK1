"""NeuroCore package root.

The installed package exposes only the canonical current API. Historical releases live outside
``src/neurocore`` and are intentionally unavailable as importable ``neurocore.vXX`` modules.
"""
from __future__ import annotations

from .version import __version__
from . import frontier as _frontier
from .frontier import *  # noqa: F401,F403

__all__ = sorted({"__version__", *_frontier.__all__})
