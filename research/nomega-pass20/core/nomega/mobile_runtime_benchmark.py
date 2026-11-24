from __future__ import annotations

"""Canonical mobile benchmark facade backed by the verified v2 implementation."""

from .mobile_runtime_benchmark_v2 import MobileRuntimeBenchmarkV2

MobileRuntimeBenchmark = MobileRuntimeBenchmarkV2

__all__ = ["MobileRuntimeBenchmark", "MobileRuntimeBenchmarkV2"]
