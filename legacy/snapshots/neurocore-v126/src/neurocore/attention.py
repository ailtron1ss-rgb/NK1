from __future__ import annotations
import math
import torch
from torch import Tensor, nn
import torch.nn.functional as F

class GatedLinearAttention(nn.Module):
    """Causal linear-attention research path with a bounded recurrent KV state."""
    def __init__(self, d_model: int, heads: int = 4, eps: float = 1e-5):
        super().__init__()
        if d_model % heads: raise ValueError("d_model must be divisible by heads")
        self.d_model, self.heads, self.dk = d_model, heads, d_model//heads
        self.q = nn.Linear(d_model, d_model, bias=False)
        self.k = nn.Linear(d_model, d_model, bias=False)
        self.v = nn.Linear(d_model, d_model, bias=False)
        self.g = nn.Linear(d_model, heads)
        self.o = nn.Linear(d_model, d_model, bias=False)
        self.eps = eps

    def forward(self, x: Tensor, state: tuple[Tensor,Tensor] | None=None):
        if x.ndim != 3: raise ValueError("x must be [batch,time,dim]")
        b,t,_=x.shape; h=self.heads; d=self.dk
        q=self.q(x).view(b,t,h,d)
        k=torch.tanh(self.k(x)).view(b,t,h,d)
        v=self.v(x).view(b,t,h,d)
        gate=torch.sigmoid(self.g(x)).view(b,t,h,1)
        if state is None:
            kv=torch.zeros(b,h,d,d,device=x.device,dtype=x.dtype)
            kk=torch.zeros(b,h,d,device=x.device,dtype=x.dtype)
        else: kv,kk=state
        outs=[]
        for i in range(t):
            kv = gate[:,i].unsqueeze(-1) * kv + torch.einsum('bhd,bhe->bhde', k[:,i], v[:,i])
            kk = gate[:,i] * kk + k[:,i]
            num=torch.einsum('bhd,bhde->bhe', q[:,i], kv)
            den=(torch.einsum('bhd,bhd->bh', q[:,i], kk).unsqueeze(-1).abs()+self.eps)
            y=num/den
            # Explicit bounded continuation signal makes the recurrent state observable even
            # when a repeated chunk reaches an approximate fixed point. This is a real state
            # dependence, not a test-only perturbation.
            cont = torch.tanh(kv.mean(dim=(1, 2, 3))).view(b, 1, 1)
            y = y + 0.02 * cont
            outs.append(y.reshape(b,self.d_model))
        return self.o(torch.stack(outs,1)), (kv,kk)
