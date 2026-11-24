from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple

Program = List[Tuple[int,int,int]]


def compile_tiny_to_hvm_v2(code: Program, temp_reg: int = 6) -> Optional[Program]:
    """Two-pass TinyVM->HVM compiler with stable reserved registers.

    HVM register 7 is the permanent TRUE/one register for unconditional jumps,
    register 6 is the load-address scratch register, and register 5 is a permanent
    zero register used for one-bit shifts. TinyVM only addresses logical registers
    0..3, so these are invisible to the source program.
    """
    if not code or any(len(x) != 3 for x in code):
        return None
    temp_reg = 6
    one_reg = 7
    zero_reg = 5
    out: Program = [(1, one_reg, 1), (1, zero_reg, 0)]
    pc_map: Dict[int,int] = {}
    patches: List[Tuple[int,str,int]] = []
    for i, raw in enumerate(code):
        op, a, b = int(raw[0]), int(raw[1]) % 4, int(raw[2])
        pc_map[i] = len(out)
        if op == 0:
            out.append((0,0,0))
        elif op == 1:
            out.extend([(1,temp_reg,b & 0xFF),(2,a,temp_reg)])
        elif op == 2:
            out.extend([(1,temp_reg,b & 0xFF),(3,a,temp_reg)])
        elif op == 3: out.append((4,a,b % 4))
        elif op == 4: out.append((5,a,b % 4))
        elif op == 5: out.append((6,a,b % 4))
        elif op == 6: out.append((7,a,b % 4))
        elif op == 7: out.append((8,a,b % 4))
        elif op == 8: out.append((9,a,zero_reg))
        elif op == 9: out.append((10,a,zero_reg))
        elif op == 10: out.append((20,a,b % 4))
        elif op == 11:
            idx=len(out); out.append((12,a,0)); patches.append((idx,'jz',b))
        elif op == 12:
            idx=len(out); out.append((13,one_reg,0)); patches.append((idx,'jmp',b))
        elif op == 13:
            if a != 0: out.append((11,0,a))
        elif op == 14:
            continue
        elif op == 15: out.append((22,a,b % 4))
        elif op == 16:  # NOT: XOR with 0xFF constant
            out.extend([(1,temp_reg,255),(6,a,temp_reg)])
        elif op in (17,18):  # MIN/MAX via CMP_LT + branch + MOV
            flag_reg=4
            out.append((11,flag_reg,a))
            out.append((20,flag_reg,b % 4))
            branch_idx=len(out)
            out.append((13 if op==17 else 12,flag_reg,0))
            out.append((11,a,b % 4))
            end_idx=len(out)
            out[branch_idx]=(13 if op==17 else 12,flag_reg,end_idx)
        elif op == 19:  # SWAP logical regs via HVM scratch
            out.extend([(11,temp_reg,a),(11,a,b % 4),(11,b % 4,temp_reg)])
        else:
            return None
        if len(out) > 768: return None
    for idx, kind, target in patches:
        if target < 0 or target >= len(code):
            out[idx]=(13,one_reg,len(out))
        else:
            out[idx]=(12 if kind=='jz' else 13, out[idx][1], pc_map[target])
    return out[:768]


def run_tiny_v2(code: Program, tape: List[int], steps: int = 512) -> Dict[str,Any]:
    from core.genesis_kernel import TinyVM
    try:
        result = TinyVM().run(code, list(tape), steps=int(steps))
        return {"ok": True, "result": int(result) & 0xFF}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def run_hvm_compiled_v2(code: Program, tape: List[int], max_steps: int = 512) -> Dict[str,Any]:
    compiled = compile_tiny_to_hvm_v2(code)
    if compiled is None:
        return {"ok": False, "supported": False, "error": "unsupported_tinyvm_opcode"}
    try:
        from .hvm_bridge import HVMBridge
        out = HVMBridge(max_steps=max_steps, max_program=768).run(compiled, tape=list(tape))
        if not out.get('ok'):
            return {"ok": False, "supported": True, "error": out.get('error','hvm_error')}
        result = out.get('result')
        if result is None and out.get('state') is not None:
            result = out['state'].regs[0]
        if result is None and 'regs' in out:
            result = out['regs'][0]
        return {"ok": True, "supported": True, "result": int(result or 0) & 0xFF, "program": compiled, "hvm": out}
    except Exception as exc:
        return {"ok": False, "supported": True, "error": str(exc)}
