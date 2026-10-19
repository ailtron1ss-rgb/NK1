from __future__ import annotations
"""Lightweight router anti-forgetting via replay + teacher logits."""
from typing import Any, Dict, List
import torch
import torch.nn.functional as F

def distill_router(student, teacher, items, names, temperature: float = 2.0, replay_weight: float = 0.5):
    if not items: return {"loss":0.0,"steps":0}
    teacher.eval(); student.train()
    opt=torch.optim.AdamW(student.parameters(), lr=1.5e-4, weight_decay=1e-4)
    losses=[]
    texts=[x.text for x in items]
    z=teacher._student_encoder(texts) if hasattr(teacher, "_student_encoder") else None
    # caller may pass a small wrapper carrying encoder+router; fallback for NΩ cores.
    if z is None: z=teacher.encoder(texts)
    with torch.no_grad():
        tlog=teacher.router(z)["probs"].clamp_min(1e-8).log()
    slog=student.router(z)["probs"].clamp_min(1e-8).log()
    kd=F.kl_div(slog, tlog.exp(), reduction="batchmean") * (temperature**2)
    targets=torch.tensor([names.index(x.target_expert) if x.target_expert in names else 0 for x in items])
    ce=F.nll_loss(slog, targets)
    loss=replay_weight*ce+(1-replay_weight)*kd
    opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(student.parameters(),1.0); opt.step()
    losses.append(float(loss.detach()))
    return {"loss":sum(losses)/len(losses),"steps":1,"kd":float(kd.detach()),"ce":float(ce.detach())}
