from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Set, Any
import time

@dataclass
class SkillNode:
    name: str
    family: str
    quality: float = 0.0
    uses: int = 0
    verified: int = 0
    prerequisites: List[str] = None
    payload: Any = None
    created: float = 0.0

    def __post_init__(self):
        if self.prerequisites is None: self.prerequisites = []
        if not self.created: self.created = time.time()

class SkillGraphV2:
    def __init__(self): self.nodes: Dict[str, SkillNode] = {}
    def add(self, name: str, family: str, quality: float, prerequisites: Optional[List[str]] = None, payload: Any = None) -> SkillNode:
        n = SkillNode(name, family, float(quality), 0, 1 if quality >= .999 else 0, prerequisites or [], payload)
        self.nodes[name] = n; return n
    def use(self, name: str, verified: bool, quality: float):
        if name not in self.nodes: return
        n=self.nodes[name]; n.uses += 1; n.quality = .9*n.quality + .1*float(quality); n.verified += int(verified)
    def available(self, family: str, min_quality: float = .8) -> List[SkillNode]:
        return [n for n in self.nodes.values() if n.family == family and n.quality >= min_quality and all(p in self.nodes for p in n.prerequisites)]
    def closure(self, name: str) -> List[str]:
        out=[]; seen=set()
        def dfs(x):
            if x in seen or x not in self.nodes: return
            seen.add(x)
            for p in self.nodes[x].prerequisites: dfs(p)
            out.append(x)
        dfs(name); return out
    def stats(self):
        return {"skills": len(self.nodes), "verified": sum(n.verified for n in self.nodes.values()), "families": sorted({n.family for n in self.nodes.values()})}
    def export(self): return {k:asdict(v) for k,v in self.nodes.items()}
    def import_(self, blob):
        self.nodes={k:SkillNode(**v) for k,v in blob.items()}
