from __future__ import annotations
"""Deterministic cache for verified answers and executable procedures."""
from collections import OrderedDict
import hashlib, time
from typing import Any, Dict, Optional

class VerifiedCache:
    def __init__(self, capacity: int = 256, ttl_s: float = 7*24*3600):
        self.capacity=capacity; self.ttl_s=ttl_s; self.items=OrderedDict()
    def _key(self, text: str, context: Dict[str, Any]) -> str:
        stable={'a','b','c','d','op','expected','program_kind','task_seed','task_count','program_candidates','program_temperature','program_verify_threshold','tape'}
        safe={k:v for k,v in context.items() if k in stable}
        raw=repr((text, sorted(safe.items(), key=lambda x:x[0]))).encode()
        return hashlib.sha256(raw).hexdigest()[:24]
    def get(self, text: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        k=self._key(text, context); row=self.items.get(k)
        if not row: return None
        if time.time()-row['ts']>self.ttl_s:
            self.items.pop(k, None); return None
        self.items.move_to_end(k)
        return dict(row['value'])
    def put(self, text: str, context: Dict[str, Any], value: Dict[str, Any]) -> str:
        k=self._key(text, context); self.items[k]={'ts':time.time(),'value':dict(value)}; self.items.move_to_end(k)
        while len(self.items)>self.capacity: self.items.popitem(last=False)
        return k
    def clear(self): self.items.clear()
    def stats(self): return {'size':len(self.items),'capacity':self.capacity}
    def export(self): return dict(self.items)
    def load(self, blob): self.items=OrderedDict(blob or {})
