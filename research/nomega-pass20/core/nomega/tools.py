from __future__ import annotations
"""Safe bounded tool registry. No arbitrary host code is exposed."""
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

@dataclass
class ToolSpec:
    name: str
    description: str
    cost: float

class SafeToolRegistry:
    def __init__(self):
        self._tools: Dict[str, tuple[ToolSpec, Callable[..., Dict[str, Any]]]] = {}
    def register(self, name: str, description: str, cost: float, fn: Callable[..., Dict[str, Any]]) -> None:
        if not name or any(ch in name for ch in " /\\"):
            raise ValueError("invalid tool name")
        self._tools[name] = (ToolSpec(name, description, float(cost)), fn)
    def list(self) -> List[Dict[str, Any]]:
        return [spec.__dict__.copy() for spec, _ in self._tools.values()]
    def call(self, name: str, **kwargs) -> Dict[str, Any]:
        item = self._tools.get(name)
        if item is None: return {"ok": False, "error": "unknown_tool"}
        spec, fn = item
        try:
            out = dict(fn(**kwargs)); out.setdefault("tool", spec.name); out.setdefault("cost", spec.cost); return out
        except Exception as exc:
            return {"ok": False, "tool": spec.name, "error": str(exc), "cost": spec.cost}

def default_registry() -> SafeToolRegistry:
    r=SafeToolRegistry()
    def calculator(a,b,op):
        a,b=int(a),int(b); op=str(op)
        vals={"sum":(a+b)&255,"sub":(a-b)&255,"mul":(a*b)&255,"xor":a^b,"and":a&b,"or":a|b,"min":min(a,b),"max":max(a,b)}
        if op not in vals: return {"ok":False,"error":"unsupported_operation"}
        return {"ok":True,"result":int(vals[op]),"verified":True}
    r.register("calculator","bounded integer arithmetic",0.05,calculator)
    return r
