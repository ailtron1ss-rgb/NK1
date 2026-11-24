from __future__ import annotations
from collections import Counter
from typing import Any, Dict, List
import hashlib, time

class MemoryConsolidatorV2:
    """Promotes repeated verified episodes into semantic/procedure memory and deduplicates near-identical entries."""
    def __init__(self, min_support=2, similarity_threshold=0.92): self.min_support=min_support; self.similarity_threshold=similarity_threshold
    def _signature(self, text): return hashlib.sha1(' '.join(text.lower().split()).encode()).hexdigest()[:16]
    def consolidate(self,memory) -> Dict[str,Any]:
        now=time.time(); groups={}
        for item in list(memory.items.values()):
            sig=self._signature(item.text); groups.setdefault(sig,[]).append(item)
        promoted=0; deduped=0
        for sig,items in groups.items():
            verified=[x for x in items if x.verified]
            if len(verified)>=self.min_support:
                best=max(verified,key=lambda x:x.reward)
                if best.kind=='episode': best.kind='semantic'; best.metadata['support_count']=len(verified); best.metadata['consolidated_v2']=now; promoted+=1
            for item in items[1:]:
                if item.key==items[0].key: continue
                if item.verified==items[0].verified and abs(item.reward-items[0].reward)<0.05:
                    if item.key in memory.items: del memory.items[item.key]; deduped+=1
        return {'groups':len(groups),'promoted':promoted,'deduped':deduped,'size':len(memory.items)}
