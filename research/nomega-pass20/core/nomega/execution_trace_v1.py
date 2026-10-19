from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Tuple
import hashlib

Program = List[Tuple[int, int, int]]

@dataclass(frozen=True)
class TraceStepV1:
    step: int
    pc: int
    op: int
    a: int
    b: int
    regs: Tuple[int, ...]
    out: int

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["regs"] = list(self.regs)
        return d

@dataclass(frozen=True)
class ExecutionTraceV1:
    ok: bool
    result: int
    steps: int
    halted: bool
    trace: Tuple[TraceStepV1, ...]
    error: str = ""

    @property
    def fingerprint(self) -> str:
        payload = [(x.step, x.pc, x.op, x.a, x.b, x.regs, x.out) for x in self.trace]
        return hashlib.sha256(repr((self.result, self.steps, self.halted, payload)).encode()).hexdigest()[:24]

    def to_dict(self) -> Dict[str, Any]:
        return {"ok": self.ok, "result": self.result, "steps": self.steps,
                "halted": self.halted, "error": self.error,
                "fingerprint": self.fingerprint,
                "trace": [x.to_dict() for x in self.trace]}


def trace_tinyvm_v1(code: Program, tape: List[int], steps: int = 512) -> ExecutionTraceV1:
    """Reference TinyVM tracer mirroring the project VM semantics.

    This intentionally duplicates semantics instead of instrumenting the production VM,
    so the trace path can act as an independent diagnostic channel.
    """
    REG_N, TAPE_N = 4, 8
    reg = [0] * REG_N
    mem = [(tape[i] if i < len(tape) else 0) & 255 for i in range(TAPE_N)]
    pc = 0; out = 0; halted = False; rows: List[TraceStepV1] = []
    try:
        if not code:
            return ExecutionTraceV1(True, 0, 0, False, ())
        for step in range(int(steps)):
            if pc < 0 or pc >= len(code):
                break
            op, a, b = code[pc]
            op = int(op) % 20; a = int(a) % REG_N; b = int(b) & 255
            before_pc = pc
            if op == 14:
                halted = True
            elif op == 1:
                reg[a] = mem[b % TAPE_N]
            elif op == 2:
                mem[b % TAPE_N] = reg[a]
            elif op == 3:
                reg[a] = (reg[a] + reg[b % REG_N]) & 255
            elif op == 4:
                reg[a] = (reg[a] - reg[b % REG_N]) & 255
            elif op == 5:
                reg[a] = (reg[a] ^ reg[b % REG_N]) & 255
            elif op == 6:
                reg[a] = (reg[a] & reg[b % REG_N]) & 255
            elif op == 7:
                reg[a] = (reg[a] | reg[b % REG_N]) & 255
            elif op == 8:
                reg[a] = (reg[a] << 1) & 255
            elif op == 9:
                reg[a] = (reg[a] >> 1) & 255
            elif op == 10:
                reg[a] = 1 if reg[a] < reg[b % REG_N] else 0
            elif op == 11:
                if reg[a] == 0:
                    pc = b % len(code)
                    rows.append(TraceStepV1(step, before_pc, op, a, b, tuple(reg), out))
                    continue
            elif op == 12:
                pc = b % len(code)
                rows.append(TraceStepV1(step, before_pc, op, a, b, tuple(reg), out))
                continue
            elif op == 13:
                out = reg[a]
            elif op == 15:
                reg[a] = (reg[a] * reg[b % REG_N]) & 255
            elif op == 16:
                reg[a] = (255 - reg[a]) & 255
            elif op == 17:
                reg[a] = min(reg[a], reg[b % REG_N])
            elif op == 18:
                reg[a] = max(reg[a], reg[b % REG_N])
            elif op == 19:
                rb = b % REG_N
                reg[a], reg[rb] = reg[rb], reg[a]
            rows.append(TraceStepV1(step, before_pc, op, a, b, tuple(reg), out))
            if halted:
                return ExecutionTraceV1(True, out & 255, step + 1, True, tuple(rows))
            pc += 1
        return ExecutionTraceV1(True, out & 255, len(rows), halted, tuple(rows))
    except Exception as exc:
        return ExecutionTraceV1(False, out & 255, len(rows), halted, tuple(rows), str(exc))
