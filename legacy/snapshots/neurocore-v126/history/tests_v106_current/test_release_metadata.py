from __future__ import annotations

import tomllib
from pathlib import Path

from neurocore.frontier import CURRENT_ENGINE_VERSION, CURRENT_FRONTIER
from neurocore.current.contracts import CURRENT_ENGINE_VERSION as CURRENT_CONTRACT_ENGINE_VERSION


def test_source_package_version_matches_frontier() -> None:
    pyproject = tomllib.loads(Path(__file__).resolve().parents[2].joinpath("pyproject.toml").read_text())
    package_version = str(pyproject["project"]["version"])
    expected = f"{CURRENT_FRONTIER // 100}.{CURRENT_FRONTIER % 100:02d}.0"
    assert package_version == expected


def test_frontier_engine_contract_is_current() -> None:
    assert CURRENT_FRONTIER == 106
    assert CURRENT_ENGINE_VERSION == CURRENT_CONTRACT_ENGINE_VERSION == "v106-causal-trunk"
