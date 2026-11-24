from __future__ import annotations
"""Memory consolidation utilities."""
from typing import Dict, Any, List
import time

class MemoryConsolidator:
    def consolidate(self, memory) -> Dict[str, Any]:
        now = time.time(); promoted = 0; evicted = 0
        for key, item in list(memory.items.items()):
            age_h = max(0.0, (now - item.created_at) / 3600.0)
            if item.verified and item.reward > 0.8:
                if item.kind == "episode":
                    item.kind = "semantic"
                    item.metadata["consolidated_at"] = now
                    promoted += 1
            if age_h > 168 and item.reward < 0.0 and not item.verified:
                del memory.items[key]; evicted += 1
        return {"promoted": promoted, "evicted": evicted, "size": len(memory.items)}
