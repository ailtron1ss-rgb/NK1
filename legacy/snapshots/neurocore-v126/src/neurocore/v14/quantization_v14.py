import torch
def fake_int8(x):
    qmax=127.; s=x.detach().abs().amax().clamp_min(1e-8)/qmax; return torch.round(x/s).clamp(-qmax,qmax)*s
def model_output_drift(model,x,mask=None):
    with torch.no_grad(): out,_=model(x,deep_mask=mask)
    return {k:float((v-fake_int8(v)).abs().mean()) for k,v in out.items() if torch.is_floating_point(v)}
