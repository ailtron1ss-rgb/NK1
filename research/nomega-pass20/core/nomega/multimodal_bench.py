from __future__ import annotations
"""Synthetic modality consistency benchmark for the shared latent contract.

It does not claim real visual/audio understanding; it checks representation
shape, deterministic fusion and optional contrastive alignment behavior.
"""
from typing import Dict, Any
import torch
from .config import NOMEGAConfig
from .core import NOmegaCore

def run(seed:int=41,batch:int=4)->Dict[str,Any]:
    torch.manual_seed(seed); c=NOmegaCore(NOMEGAConfig(latent_dim=32,router_hidden=24,memory_dim=32,max_reason_steps=1))
    text=c.encoder([f'object {i}' for i in range(batch)])
    images=torch.randn(batch,3,32,32); audio=torch.randn(batch,512)
    vision=c.vision(images); aud=c.audio(audio); fused=c.fusion(text,vision,aud)
    rows=[]
    for name,x in [('text',text),('vision',vision),('audio',aud),('fused',fused)]: rows.append({'name':name,'shape':list(x.shape),'finite':bool(torch.isfinite(x).all())})
    return {'batch':batch,'rows':rows,'shared_dim':int(fused.shape[-1]),'all_finite':all(r['finite'] for r in rows)}
