from __future__ import annotations
"""Compact attention-like retrieval memory using cosine similarity."""
from typing import Any, Dict, List
import torch, torch.nn.functional as F

class AttentionMemory:
    def __init__(self, dim:int=96, capacity:int=512): self.dim=dim; self.capacity=capacity; self.items=[]
    def put(self,key:str,vector:torch.Tensor,value:Any,score:float=0.0,meta=None):
        v=F.normalize(vector.detach().float().reshape(1,-1),dim=-1)[0].tolist(); self.items.append({'key':key,'vector':v,'value':value,'score':float(score),'meta':dict(meta or {})}); self.items=self.items[-self.capacity:]
    def search(self,vector:torch.Tensor,k:int=4):
        if not self.items:return []
        q=F.normalize(vector.detach().float().reshape(1,-1),dim=-1)
        mat=torch.tensor([x['vector'] for x in self.items],dtype=torch.float32)
        sims=(mat@q[0]).tolist()
        rows=[]
        for i,s in enumerate(sims):
            r=dict(self.items[i]); r['similarity']=float(s); rows.append(r)
        return sorted(rows,key=lambda x:(x['similarity'],x['score']),reverse=True)[:k]
    def stats(self): return {'items':len(self.items),'capacity':self.capacity}
    def export(self): return list(self.items)
    def load(self,items): self.items=list(items or [])[-self.capacity:]
