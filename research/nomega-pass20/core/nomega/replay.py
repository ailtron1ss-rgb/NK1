from __future__ import annotations
"""Small bounded replay buffer for continual learning and anti-forgetting."""
from collections import deque
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Deque, Dict, Iterable, List
import json, random

@dataclass
class ReplayItem:
    text: str
    context: Dict[str, Any]
    target_expert: str
    utility: float
    family: str = "unknown"

class ReplayBuffer:
    def __init__(self, capacity: int = 512, seed: int = 41):
        self.capacity = int(capacity)
        self.rng = random.Random(seed)
        self.items: Deque[ReplayItem] = deque(maxlen=self.capacity)

    def add(self, item: ReplayItem) -> None:
        self.items.append(item)

    def extend(self, items: Iterable[ReplayItem]) -> None:
        for item in items: self.add(item)

    def sample(self, n: int) -> List[ReplayItem]:
        return self.rng.sample(list(self.items), min(int(n), len(self.items))) if self.items else []

    def by_family(self) -> Dict[str, int]:
        out: Dict[str, int] = {}
        for x in self.items: out[x.family] = out.get(x.family, 0) + 1
        return out

    def state_dict(self) -> Dict[str, Any]:
        return {"capacity": self.capacity, "items": [asdict(x) for x in self.items]}

    def save(self, path: Path) -> None:
        p = Path(path); p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.state_dict(), ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    def load(self, path: Path) -> bool:
        p = Path(path)
        if not p.exists(): return False
        try:
            blob = json.loads(p.read_text(encoding="utf-8"))
            self.capacity = int(blob.get("capacity", self.capacity))
            self.items.clear()
            for x in blob.get("items", []): self.add(ReplayItem(**x))
            return True
        except Exception:
            return False
