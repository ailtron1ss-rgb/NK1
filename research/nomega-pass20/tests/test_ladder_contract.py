"""LTS 8.0 contract tests — all stages."""
from __future__ import annotations
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.nullseed_spine import full_report
from core.bottom_up import BottomUpSynth
from core.metrics_truth import measure_all

def test_smoke_closed():
    assert full_report(seed=1, profile="smoke").get("closed") == 36

def test_channels_separated():
    r = measure_all(41)
    assert r["closed"] == 36
    assert r["structural_pure"] >= 3
    assert r["systematic"] >= 3
    assert r["blank_pure"] <= r["structural_pure"]

def test_promoted_v7():
    from core.plugins.strong_pure_v7 import attack_strong_v7
    assert attack_strong_v7(41, gens=6, pop=16)["bottomup_wild3_solved"] >= 4

def test_modules():
    from core.modules_catalog import build_catalog
    cat = build_catalog()
    assert cat["n"] >= 4

def test_bench_runs():
    from core.external_bench import run_bench
    r = run_bench(41, gens=8, pop=16)
    assert r["n"] == 5
    assert 0 <= r["solved"] <= 5

if __name__ == "__main__":
    test_smoke_closed(); print("OK smoke")
    test_channels_separated(); print("OK channels")
    test_promoted_v7(); print("OK v7")
    test_modules(); print("OK modules")
    test_bench_runs(); print("OK bench")
    print("ALL PASS")
