from __future__ import annotations
from typing import Optional, Dict, Any
import torch
import torch.nn as nn
import torch.nn.functional as F

class GroundingAlignerV2(nn.Module):
    """Tiny cross-modal alignment head. It aligns already-encoded modalities; it is not a full vision/audio foundation encoder."""
    def __init__(self, dim=32, hidden=64):
        super().__init__(); self.text=nn.Linear(dim,hidden); self.image=nn.Linear(dim,hidden); self.audio=nn.Linear(dim,hidden); self.temp=nn.Parameter(torch.tensor(0.07))
    def normalize(self,x,p): return F.normalize(p(x),dim=-1)
    def forward(self,text,image=None,audio=None):
        zt=self.normalize(text,self.text); zi=self.normalize(image,self.image) if image is not None else None; za=self.normalize(audio,self.audio) if audio is not None else None
        return zt,zi,za
    def contrastive(self,a,b):
        if a is None or b is None: return torch.zeros((),device=next(self.parameters()).device)
        logits=(a@b.t())/self.temp.clamp(0.02,1.0); labels=torch.arange(a.size(0),device=a.device); return 0.5*(F.cross_entropy(logits,labels)+F.cross_entropy(logits.t(),labels))
    def alignment_report(self,text,image=None,audio=None):
        with torch.no_grad():
            zt,zi,za=self.forward(text,image,audio); sims={}
            if zi is not None: sims['text_image']=float((zt*zi).sum(-1).mean())
            if za is not None: sims['text_audio']=float((zt*za).sum(-1).mean())
            return sims
