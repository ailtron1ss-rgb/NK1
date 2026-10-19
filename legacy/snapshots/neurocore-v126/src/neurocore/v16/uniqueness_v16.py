from __future__ import annotations
import torch

def credit_effect(credit_before,credit_after): return (credit_after-credit_before).abs().mean()
def routing_kl(p,q): return (p*(p.clamp_min(1e-8).log()-q.clamp_min(1e-8).log())).sum(-1).mean()
def expert_specialization_entropy(p):
    m=p.mean(dim=tuple(range(p.ndim-2))); return -(m*m.clamp_min(1e-8).log()).sum(-1)

def evidence_coupling_signature(out):
    return {'evidence_mean':float(out['evidence'].detach().mean()),'credit_mean':float(out['expert_credit'].detach().mean()),'pe_mean':float(out['prediction_error'].detach().mean()),'unc_mean':float(out['uncertainty'].detach().mean())}
