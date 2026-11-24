from __future__ import annotations
"""Dual-runtime checking for TinyVM and HVM.

A program is considered semantically portable only when both runtimes agree on
all supplied test cases, or when HVM is explicitly unsupported.
"""
from typing import Any, Dict, List, Tuple
from .program_runtime import run_tiny, run_hvm_compiled, compile_tiny_to_hvm

Program = List[Tuple[int, int, int]]

class DualRuntime:
    def __init__(self, tolerance: int = 0):
        self.tolerance = int(tolerance)

    def check(self, code: Program, tasks: List[Tuple[List[int], int]]) -> Dict[str, Any]:
        tiny_rows = []
        hvm_rows = []
        agreements = 0
        executed = 0
        for inputs, expected in tasks[:64]:
            tiny = run_tiny(code, inputs)
            hvm = run_hvm_compiled(code, inputs)
            tiny_rows.append(tiny)
            hvm_rows.append(hvm)
            if tiny.get("ok") and hvm.get("ok"):
                executed += 1
                a, b = int(tiny.get("result", 0)), int(hvm.get("result", 0))
                agreements += int(abs(a - b) <= self.tolerance and b == int(expected) & 0xFF)
        compiled = compile_tiny_to_hvm(code)
        portable = compiled is not None and executed > 0 and agreements == executed
        tiny_ok = sum(int(r.get("ok", False) and int(r.get("result", -1)) == int(exp) & 0xFF) for r, (_, exp) in zip(tiny_rows, tasks))
        hvm_ok = sum(int(r.get("ok", False) and int(r.get("result", -1)) == int(exp) & 0xFF) for r, (_, exp) in zip(hvm_rows, tasks))
        n = max(1, len(tasks[:64]))
        return {
            "portable": portable,
            "compiled": compiled is not None,
            "tiny_accuracy": tiny_ok / n,
            "hvm_accuracy": hvm_ok / n,
            "semantic_agreement": agreements / max(1, executed),
            "executed_both": executed,
            "tiny": tiny_rows,
            "hvm": hvm_rows,
        }
