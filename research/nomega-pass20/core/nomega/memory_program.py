from __future__ import annotations
"""Convert repeatedly verified procedural memories into reusable program memories."""
from typing import Any, Dict

def consolidate_verified_procedures(memory, min_reward: float = 0.8, min_hits: int = 2) -> Dict[str, Any]:
    groups: Dict[str, list] = {}
    for item in memory.items.values():
        if item.kind not in {"episode", "semantic", "procedure", "program"} or not item.verified or item.reward < min_reward:
            continue
        signature = item.metadata.get("program") or item.metadata.get("procedure_signature") or item.metadata.get("program_signature")
        if signature is None: continue
        key = str(signature)
        groups.setdefault(key, []).append(item)
    promoted=0
    for signature, items in groups.items():
        if len(items) >= min_hits:
            source=items[0]
            if source.kind != "program":
                source.kind="procedure"
                source.metadata["consolidated_program"] = signature
                source.metadata["support"] = len(items)
                promoted += 1
    return {"groups":len(groups),"promoted":promoted}
