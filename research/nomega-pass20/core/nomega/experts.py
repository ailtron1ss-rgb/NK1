from __future__ import annotations
from typing import Dict, Any, List, Optional, Tuple
from abc import ABC, abstractmethod
from pathlib import Path
import re
import torch
import torch.nn as nn
from .program_runtime import synthetic_tasks, run_tiny, run_hvm_compiled
from .dual_runtime import DualRuntime
from .planner import TaskPlanner
from .canonical_neural_execution_v1 import CanonicalNeuralProgramBridgeV1

class BaseExpert(nn.Module, ABC):
    name: str = "base"

    @abstractmethod
    def run(self, state, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the expert against a concrete runtime state."""
        raise RuntimeError("BaseExpert.run must be implemented by a concrete expert")

class HeuristicExpert(BaseExpert):
    name = "heuristic"
    def __init__(self, dim: int = 96):
        super().__init__()
        self.proj = nn.Sequential(nn.LayerNorm(dim), nn.Linear(dim, dim), nn.SiLU(), nn.Linear(dim, dim))
    def run(self, state, context):
        z = self.proj(state.vector.unsqueeze(0)).squeeze(0)
        score = float(torch.sigmoid(z.mean()).detach())
        return {"type": "heuristic", "summary": context.get("text", ""), "score": score, "latent": z.detach()}

class PlannerExpert(BaseExpert):
    name = "planner"
    def __init__(self):
        super().__init__(); self.planner = TaskPlanner()
    def run(self, state, context):
        plan = [p.to_dict() for p in self.planner.plan(context.get("text", ""), state.task_type, context)]
        return {"type": "planner", "plan": plan, "result": None, "latent": state.vector.detach()}

class NeuralInventExpert(BaseExpert):
    """Canonical neural program proposer backed by V13 and real execution evidence."""
    name = "neural_invent"

    def __init__(self, root=None, seed: int = 41, bridge=None):
        super().__init__()
        self.bridge = bridge or (CanonicalNeuralProgramBridgeV1(root or Path.cwd(), seed=seed + 2027) if root is not None else None)
        self.available = bool(self.bridge is not None and self.bridge.available)

    def run(self, state, context: Dict[str, Any]):
        if self.bridge is None:
            return {"type": "neural_invent", "available": False, "reason": "canonical_bridge_unconfigured", "latent": state.vector.detach()}
        if not self.bridge.available:
            return {"type": "neural_invent", "available": False, "reason": getattr(self.bridge, "load_error", "checkpoint_missing"), "latent": state.vector.detach()}
        try:
            candidate = self.bridge.propose(
                str(context.get("text", "")),
                family=context.get("program_family") or context.get("task_family"),
                latent=state.vector.detach(),
                beam_size=max(1, min(3, int(context.get("program_candidates", 2)))),
                max_len=int(context.get("program_max_len", 24)),
            )
            if candidate is None:
                return {"type": "neural_invent", "available": True, "status": "no_semantic_family", "latent": state.vector.detach()}
            return {
                "type": "neural_invent",
                "available": True,
                "program": candidate.program,
                "program_family": candidate.family,
                "candidate_source": candidate.source,
                "model_version": candidate.model_version,
                "checkpoint_digest": candidate.checkpoint_digest,
                # The candidate is deliberately unverified here. Core/executable-spine
                # must perform independent execution and only then assign evidence.
                "verified_candidate": False,
                "candidate_score": 0.0,
                "result": None,
                "latent": state.vector.detach(),
            }
        except Exception as exc:
            return {"type": "neural_invent", "available": True, "error": str(exc), "latent": state.vector.detach()}

class SkillExpert(BaseExpert):
    name = "skill"
    def run(self, state, context):
        hits = context.get("skill_hits", [])
        if not hits:
            return {"type":"skill","result":None,"verified_candidate":False,"hits":[],"latent":state.vector.detach()}
        best=hits[0]; program=best.get("program")
        tape=context.get("tape")
        if tape is None:
            raw_inputs=context.get("inputs")
            if isinstance(raw_inputs, (list, tuple)):
                tape=[int(v) for v in raw_inputs]
            elif context.get("a") is not None:
                values=[]
                for key in ("a","b","c","d","e","f","g","h"):
                    if context.get(key) is not None:
                        values.append(int(context[key]))
                tape=values
        tape=tape or [0]*8
        tape=(tape + [0]*8)[:8]
        tiny=run_tiny(program,tape) if isinstance(program,list) else {"ok":False}
        hvm=run_hvm_compiled(program,tape) if isinstance(program,list) else {"ok":False}
        tiny_result=tiny.get("result")
        hvm_result=hvm.get("result")
        result=hvm_result if hvm.get("ok") else tiny_result
        agreement=bool(tiny.get("ok") and hvm.get("ok") and tiny_result==hvm_result)
        expected=context.get("expected")
        expected_match=(expected is None or result==expected)
        verified=bool(agreement and expected_match)
        return {"type":"skill","skill_id":best.get("skill_id"),"program":program,"result":result,"verified_candidate":verified,"candidate_score":float(best.get("quality",0.0)),"dual_runtime":{"tiny_accuracy":1.0 if tiny.get("ok") else 0.0,"hvm_accuracy":1.0 if hvm.get("ok") else 0.0,"semantic_agreement":1.0 if agreement else 0.0,"expected_match":1.0 if expected_match else 0.0},"latent":state.vector.detach()}

class SymbolicExpert(BaseExpert):
    name = "symbolic"
    def run(self, state, context):
        query = context.get("text", ""); result = None
        if context.get("op") is not None and (context.get("a") is not None or context.get("b") is not None):
            a, b, op = int(context.get("a",0)), int(context.get("b",0)), context.get("op")
            try:
                if op == "sum": result = (a + b) & 255
                elif op == "sub": result = (a - b) & 255
                elif op == "mul": result = (a * b) & 255
                elif op == "xor": result = a ^ b
                elif op == "and": result = a & b
                elif op == "or": result = a | b
                elif op == "min": result = min(a, b)
                elif op == "max": result = max(a, b)
                elif op == "eq": result = int(a == b)
                elif op == "sum3": result = (a + b + int(context.get("c",0))) & 255
                elif op == "xor3": result = a ^ b ^ int(context.get("c",0))
                elif op == "max3": result = max(a,b,int(context.get("c",0)))
                elif op == "min3": result = min(a,b,int(context.get("c",0)))
                elif op == "dot2": result = (a*b + int(context.get("c",0))*int(context.get("d",0))) & 255
                elif op == "clamp": result = min(max(a,b),int(context.get("c",192)))
                elif op == "parity": result = int(bin(a & 255).count("1") & 1)
                elif op == "next_inc2": result = int(context.get("c",0)) + (int(context.get("c",0))-int(context.get("b",0)))
                elif op == "diff": result = int(context.get("b",0))-int(context.get("a",0))
                elif op == "sum_then_clamp": result = min(max(a+b,int(context.get("lo",0))),int(context.get("hi",255)))
                elif op == "xor_then_parity": result = int(((a^b)&0xFF).bit_count() & 1)
                elif op == "diff_then_offset": result = (int(context.get("b",0))-a) + int(context.get("k",0))
                elif op == "dot_then_mod": result = (a*b + int(context.get("c",0))*int(context.get("d",0))) % max(1,int(context.get("mod",1)))
                elif op == "minmax_mix": result = max(min(a,b), min(b,int(context.get("c",0))))
                elif op == "nested_arithmetic": result = ((a-b)*int(context.get("c",0))) + int(context.get("k",0))
                elif op == "mul2": result = a * b
                elif op == "sub_offset": result = (int(context.get("b",0))-a) + int(context.get("k",0))
                elif op == "minmax3": result = max(min(a,b), min(b,int(context.get("c",0))))
                elif op == "parity_mix": result = int((a^b^int(context.get("c",0))).bit_count() & 1)
                elif op == "clamp_sum": result = min(max(a+b,int(context.get("lo",0))), int(context.get("hi",255)))
                elif op == "dot2_mod": result = (a*b + int(context.get("c",0))*int(context.get("k",0))) % max(1,int(context.get("m",1)))
                elif op == "nested3": result = ((a-b)*int(context.get("c",0))) + int(context.get("k",0))
                elif op == "sequence_inc": result = a + len(range(max(0,int(context.get("b",0)))))
                elif op == "sequence_diff": result = int(context.get("c",0))-int(context.get("b",0))
                elif op == "compose_sum_xor": result = (a+b) ^ int(context.get("c",0))
                elif op == "compose_min_max": result = max(min(a,b),int(context.get("c",0)))
                elif op == "compose_affine": result = (a*int(context.get("k",0))) + b + int(context.get("c",0))
                elif op == "compose_mod_chain": result = ((a+b)%max(1,int(context.get("m",1)))) ^ int(context.get("c",0))
                elif op == "compose_clamp_offset": result = min(max(a+b+int(context.get("k",0)),int(context.get("lo",0))),int(context.get("hi",255)))
                elif op == "compose_nested_parity": result = int((((a-b)*int(context.get("c",0)))+int(context.get("k",0))).bit_count() & 1)
                elif op == "inverse_sum": result = a+b
                elif op == "invariant_xor": result = (a^b)^a^b
            except Exception: result = None
        hvm = None
        if context.get("program") is not None:
            try:
                from .hvm_bridge import HVMBridge
                hvm = HVMBridge().run(context["program"], context.get("tape"))
                if hvm.get("ok") and hvm.get("result") is not None: result = hvm["result"]
            except Exception as exc: hvm = {"ok": False, "error": str(exc)}
        return {"type": "symbolic", "query": query, "result": result, "hvm": hvm,
                "verified_candidate": result is not None, "latent": state.vector.detach()}

class MemoryExpert(BaseExpert):
    name = "memory"
    def run(self, state, context):
        hits = context.get("memory_hits", [])
        best = hits[0] if hits else None
        return {"type": "memory", "hits": hits, "best": best, "result": None, "latent": state.vector.detach()}

class ExpertBank:
    def __init__(self, latent_dim: int = 96, include_neural: bool = True, include_symbolic: bool = True, include_planner: bool = True, *, root=None, neural_bridge=None):
        self.experts: Dict[str, BaseExpert] = {"heuristic": HeuristicExpert(latent_dim), "memory": MemoryExpert(), "skill": SkillExpert()}
        if include_planner: self.experts["planner"] = PlannerExpert()
        if include_neural: self.experts["neural_invent"] = NeuralInventExpert(root=root, bridge=neural_bridge)
        if include_symbolic: self.experts["symbolic"] = SymbolicExpert()
    def names(self) -> List[str]: return list(self.experts.keys())
    def get(self, name: str) -> Optional[BaseExpert]: return self.experts.get(name)
    def parameters(self):
        for e in self.experts.values():
            yield from e.parameters()
