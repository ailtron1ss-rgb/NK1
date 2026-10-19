from __future__ import annotations

import importlib

import pytest

from neurocore.current import UpstreamBackendCatalog, make_upstream_backend


def test_source_catalog_is_large_but_import_is_lazy() -> None:
    catalog = UpstreamBackendCatalog.default()
    assert len(catalog.specs()) >= 45
    assert catalog.get("fla.delta_net").import_target == "fla.layers:DeltaNet"
    assert catalog.get("fla.gdn2").import_target == "fla.layers:GatedDeltaNet2"
    assert catalog.get("fla.raven").import_target == "fla.layers:Raven"
    assert catalog.get("fla.pgdn").import_target == "fla.layers:PrecondGatedDeltaNet"
    assert catalog.get("fla.mamba3").import_target == "fla.layers:Mamba3"
    # The research environment does not require third-party sequence libraries just to import NeuroCore.
    importlib.import_module("neurocore.current")
    snapshot = catalog.snapshot()
    assert snapshot["fla.delta_net"]["availability"]["available"] is False


def test_missing_upstream_never_silently_falls_back() -> None:
    catalog = UpstreamBackendCatalog.default()
    with pytest.raises(ImportError, match="not installed|cannot import"):
        make_upstream_backend(catalog, "fla.delta_net", hidden_size=16, num_heads=1, use_short_conv=False)


def test_research_only_backend_is_blocked_from_current() -> None:
    catalog = UpstreamBackendCatalog.default()
    with pytest.raises(PermissionError, match="research-only"):
        make_upstream_backend(catalog, "nvidia_gdn2")
