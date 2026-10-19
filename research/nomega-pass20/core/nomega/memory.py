from __future__ import annotations
from collections import OrderedDict
import hashlib, json, math, time
from typing import Iterable, List, Dict, Any, Optional
from .types import MemoryItem

class CognitiveMemory:
    """Tiered mobile memory.

    Kinds: episode, semantic, program, procedure, observation. Retrieval remains
    deterministic and dependency-light; a learned retriever can replace _embed later.
    """
    KINDS = {"episode", "semantic", "program", "procedure", "observation"}

    def __init__(self, dim: int = 96, capacity: int = 512):
        self.dim = dim
        self.capacity = capacity
        self.items: "OrderedDict[str, MemoryItem]" = OrderedDict()

    def _embed(self, text: str) -> List[float]:
        vec = [0.0] * self.dim
        tokens = [t for t in text.lower().replace("\n", " ").split() if t]
        for tok in tokens:
            h = hashlib.blake2b(tok.encode("utf-8"), digest_size=8).digest()
            n = int.from_bytes(h, "little")
            for shift, weight in ((0, 1.0), (11, -0.5), (23, 0.25)):
                i = (n >> shift) % self.dim
                vec[i] += weight
        norm = math.sqrt(sum(x*x for x in vec)) or 1.0
        return [x / norm for x in vec]

    @staticmethod
    def _cos(a: List[float], b: List[float]) -> float:
        return sum(x*y for x, y in zip(a, b))

    def put(self, text: str, kind: str = "episode", reward: float = 0.0,
            verified: bool = False, metadata: Optional[Dict[str, Any]] = None,
            key: Optional[str] = None) -> str:
        kind = kind if kind in self.KINDS else "episode"
        k = key or hashlib.sha1(f"{kind}:{text}".encode()).hexdigest()[:16]
        item = MemoryItem(k, text, kind, self._embed(text), float(reward), bool(verified),
                          metadata=metadata or {})
        self.items[k] = item
        self.items.move_to_end(k)
        while len(self.items) > self.capacity:
            self.items.popitem(last=False)
        return k

    def retrieve(self, query: str, k: int = 4, kind: Optional[str] = None) -> List[Dict[str, Any]]:
        q = self._embed(query)
        rows = []
        now = time.time()
        for item in self.items.values():
            if kind and item.kind != kind:
                continue
            cosine = self._cos(q, item.vector)
            age_h = max(0.0, (now - item.created_at) / 3600.0)
            freshness = math.exp(-age_h / (24.0 * 14.0))
            kind_bonus = 0.03 if item.kind in ("semantic", "procedure", "program") else 0.0
            verification_bonus = 0.06 if item.verified else 0.0
            score = cosine + 0.05 * max(-1.0, min(1.0, item.reward)) + kind_bonus + verification_bonus + 0.02 * freshness
            rows.append((score, item))
        rows.sort(key=lambda x: x[0], reverse=True)
        return [{
            "key": i.key, "text": i.text, "kind": i.kind, "score": round(float(s), 6),
            "reward": i.reward, "verified": i.verified, "metadata": i.metadata,
        } for s, i in rows[:max(0, k)]]

    def consolidate(self) -> Dict[str, Any]:
        now = time.time(); promoted = 0; evicted = 0
        for key, item in list(self.items.items()):
            age_h = max(0.0, (now - item.created_at) / 3600.0)
            if item.verified and item.reward >= 0.8 and item.kind == "episode":
                item.kind = "semantic"
                item.metadata["consolidated_at"] = now
                promoted += 1
            if age_h > 168 and item.reward < 0 and not item.verified:
                del self.items[key]; evicted += 1
        return {"promoted": promoted, "evicted": evicted, "size": len(self.items)}

    def put_program(self, text: str, program: Any, reward: float, verified: bool, metadata: Optional[Dict[str, Any]] = None) -> str:
        meta = dict(metadata or {})
        meta["program"] = program
        return self.put(text, kind="program", reward=reward, verified=verified, metadata=meta)

    def stats(self) -> Dict[str, Any]:
        counts: Dict[str, int] = {}
        verified = 0
        for item in self.items.values():
            counts[item.kind] = counts.get(item.kind, 0) + 1
            verified += int(item.verified)
        return {"size": len(self.items), "capacity": self.capacity, "by_kind": counts, "verified": verified}

    def export(self) -> Dict[str, Any]:
        return {k: {
            "text": v.text, "kind": v.kind, "vector": v.vector, "reward": v.reward,
            "verified": v.verified, "created_at": v.created_at, "metadata": v.metadata,
        } for k, v in self.items.items()}

    def load(self, blob: Dict[str, Any]) -> None:
        self.items.clear()
        for k, v in blob.items():
            self.items[k] = MemoryItem(
                key=k, text=v["text"], kind=v.get("kind", "episode"),
                vector=list(v.get("vector", self._embed(v["text"]))),
                reward=float(v.get("reward", 0.0)), verified=bool(v.get("verified", False)),
                created_at=float(v.get("created_at", 0.0)), metadata=dict(v.get("metadata", {}))
            )
