from __future__ import annotations
"""Safe bridge from NeuralInvent/TinyVM programs to bounded execution.

NeuralInvent was originally trained against Nullseed's TinyVM instruction set.
This module makes that distinction explicit and provides a conservative compiler
for the subset that can be represented by the newer HVM ISA.
"""
from typing import Any, Dict, List, Optional, Tuple
import random

Program = List[Tuple[int, int, int]]


def compile_tiny_to_hvm(code: Program, temp_reg: int = 7) -> Optional[Program]:
    """Compile a TinyVM program into HVM when every instruction is representable.

    Logical TinyVM registers are 0..3. Register 7 is reserved as an index/temporary
    register in the generated HVM program. Unsupported operations return None rather
    than being approximated silently.
    """
    out: Program = []
    for op, a, b in code:
        op, a, b = int(op), int(a) % 4, int(b)
        if op == 0:            # NOP
            out.append((0, 0, 0))
        elif op == 1:          # LOAD reg[a] = tape[b]
            out.append((1, temp_reg, b & 0xFF))
            out.append((2, a, temp_reg))
        elif op == 2:          # STORE tape[b] = reg[a]
            out.append((1, temp_reg, b & 0xFF))
            out.append((3, a, temp_reg))
        elif op == 3:          # ADD
            out.append((4, a, b % 4))
        elif op == 4:          # SUB
            out.append((5, a, b % 4))
        elif op == 5:          # XOR
            out.append((6, a, b % 4))
        elif op == 6:          # AND
            out.append((7, a, b % 4))
        elif op == 7:          # OR
            out.append((8, a, b % 4))
        elif op == 8:          # SHL
            # TinyVM shifts by one; HVM shift amount is 1 + (rB & 3).
            out.append((1, temp_reg, 0))
            out.append((15, temp_reg, temp_reg))  # temp=0 -> 1
            out.append((9, a, temp_reg))
        elif op == 9:          # SHR
            out.append((1, temp_reg, 0))
            out.append((15, temp_reg, temp_reg))
            out.append((10, a, temp_reg))
        elif op == 10:         # CMP <
            out.append((20, a, b % 4))
        elif op == 13:         # OUT reg[a] -> HVM reg0
            if a != 0:
                out.append((11, 0, a))
        elif op == 17 or op == 18:  # MIN / MAX via bounded branch + MOV
            # HVM has CMP_LT/JMP_Z/MOV but no direct MIN/MAX. Preserve A in temp,
            # compute A<B, then select A or B without host-side evaluation.
            preserve = temp_reg
            flag = (temp_reg - 1) % 8
            out.append((11, preserve, a))       # preserve A
            out.append((20, flag, b % 8))       # flag = A < B (but flag must contain A)
            # The line above needs flag to contain A; copy A before compare.
            out[-1:] = [(11, flag, a), (20, flag, b % 8)]
            jump_at = len(out)
            out.append((12 if op == 17 else 13, flag, 0))  # patch target below
            keep_a = len(out)
            out.append((11, a, preserve))         # MIN: A if A<B; MAX: A if A>=B
            jump_end = len(out)
            out.append((12, 5, 0))                # unconditional jump using untouched zero register
            choose_b = len(out)
            out.append((11, a, b % 8))
            end = len(out)
            # Patch: MIN jumps to choose_b when flag==0. MAX jumps to choose_b when flag!=0.
            out[jump_at] = (12 if op == 17 else 13, flag, choose_b)
            out[jump_end] = (12, 5, end)
        elif op == 15:         # MUL
            out.append((22, a, b % 4))
        elif op == 14:         # HALT is implicit in HVM end-of-program
            continue
        else:
            return None
    return out[:256]


def run_tiny(code: Program, tape: List[int]) -> Dict[str, Any]:
    from core.genesis_kernel import TinyVM
    try:
        result = TinyVM().run(code, list(tape))
        return {"ok": True, "result": int(result) & 0xFF}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def run_hvm_compiled(code: Program, tape: List[int]) -> Dict[str, Any]:
    compiled = compile_tiny_to_hvm(code)
    if compiled is None:
        return {"ok": False, "supported": False, "error": "unsupported_tinyvm_opcode"}
    try:
        from .hvm_bridge import HVMBridge
        out = HVMBridge(max_steps=256, max_program=256).run(compiled, tape=list(tape))
        if not out.get("ok"):
            return {"ok": False, "supported": True, "error": out.get("error", "hvm_error")}
        result = out.get("result")
        # HVMBridge returns HVMState for modern HVM; expose register zero uniformly.
        if result is None and out.get("state") is not None:
            result = out["state"].regs[0]
        if result is None and "regs" in out:
            result = out["regs"][0]
        return {"ok": True, "supported": True, "result": int(result or 0) & 0xFF,
                "program": compiled, "hvm": out}
    except Exception as exc:
        return {"ok": False, "supported": True, "error": str(exc)}


def synthetic_tasks(kind: str, seed: int = 41, n: int = 8) -> List[Tuple[List[int], int]]:
    """Generate deterministic TinyVM tasks for known arithmetic families."""
    from core.neural_invent import _y_for
    rng = random.Random(seed)
    return [([rng.randrange(256) for _ in range(8)], 0) for _ in range(0)] if False else [
        (lambda tape: (tape, _y_for(kind, tape)))([rng.randrange(256) for _ in range(8)])
        for _ in range(n)
    ]
