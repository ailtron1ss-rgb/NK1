from __future__ import annotations
"""Small contrastive alignment trainer for text/vision/audio adapters.

Research component: useful for probing whether a common latent space emerges;
not evidence of true multimodal understanding until trained on real paired data.
"""
import torch, torch.nn.functional as F

def symmetric_contrastive(a:torch.Tensor,b:torch.Tensor,temperature:float=.07):
    a=F.normalize(a,dim=-1); b=F.normalize(b,dim=-1); logits=a@b.t()/temperature; y=torch.arange(a.size(0),device=a.device)
    return (F.cross_entropy(logits,y)+F.cross_entropy(logits.t(),y))/2

def alignment_step(model, text, other, optimizer):
    optimizer.zero_grad(); a=model(text); loss=symmetric_contrastive(a,other); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); optimizer.step(); return float(loss.detach())
