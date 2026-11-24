from __future__ import annotations
"""Bounded bridge from NΩ to Nullseed's Hierarchical VM.

The bridge accepts explicit integer programs only. It normalizes the current HVM
API (which returns HVMState) into a small JSON-friendly result with registers,
steps and output register zero. No arbitrary Python or host-code execution is
performed here.
"""
from typing import Any, Dict, List, Tuple, Optional

class HVMBridge:
    def __init__(self, max_steps: int = 256, max_program: int = 256):
        self.max_steps = max_steps
        self.max_program = max_program

    def run(self, program: List[Tuple[int, int, int]], tape: Optional[List[int]] = None) -> Dict[str, Any]:
        from core.hierarchical_vm import run_hvm
        code = list(program)[:self.max_program]
        inputs = list(tape or [0] * 8)
        try:
            state = run_hvm(code, inputs=inputs, max_steps=self.max_steps)
            # Modern HVM returns HVMState.
            if hasattr(state, "regs"):
                return {
                    "ok": True,
                    "result": int(state.regs[0]) & 0xFF,
                    "regs": list(state.regs),
                    "tape": list(state.tape),
                    "steps": int(state.steps),
                    "halted": bool(state.halted),
                }
            if isinstance(state, dict):
                return {"ok": True, **state}
            return {"ok": True, "result": state}
        except TypeError:
            # Compatibility path for older HVM signatures.
            try:
                state = run_hvm(code, inputs)
                if hasattr(state, "regs"):
                    return {"ok": True, "result": int(state.regs[0]) & 0xFF,
                            "regs": list(state.regs), "tape": list(state.tape),
                            "steps": int(state.steps), "halted": bool(state.halted)}
                return {"ok": True, "result": state}
            except Exception as exc:
                return {"ok": False, "error": str(exc)}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
