"""Simple CPU reference memory kept only for baseline comparisons."""
from dataclasses import dataclass
from typing import List
import math

@dataclass
class MemoryItem:
    vector: List[float]
    payload: str
    timestamp: int
    importance: float = 0.0

class EpisodicMemory:
    def __init__(self, capacity: int = 4096):
        if capacity <= 0: raise ValueError("capacity must be > 0")
        self.capacity, self.items = capacity, []
    @staticmethod
    def cosine(a: List[float], b: List[float]) -> float:
        if len(a) != len(b): raise ValueError("Vector dimension mismatch")
        aa = math.sqrt(sum(x*x for x in a)); bb = math.sqrt(sum(x*x for x in b))
        if aa == 0 or bb == 0: return 0.0
        return sum(x*y for x,y in zip(a,b))/(aa*bb)
    def add(self, item: MemoryItem) -> None:
        self.items.append(item)
        if len(self.items) > self.capacity:
            self.items.sort(key=lambda x:(x.importance,x.timestamp)); self.items = self.items[-self.capacity:]
    def retrieve(self, query: List[float], k: int=5) -> List[MemoryItem]:
        return sorted(self.items, key=lambda x:self.cosine(query,x.vector), reverse=True)[:max(0,k)]
