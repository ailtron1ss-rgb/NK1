import torch
def delayed_association(batch=16,steps=32,d=16,delay=16,seed=0):
    g=torch.Generator().manual_seed(seed); x=torch.randn(batch,steps,d,generator=g); target=x[:,0].clone(); x[:,1:1+delay]+=0.03*torch.randn(batch,delay,d,generator=g); return x,target
def change_point(batch=16,steps=32,d=16,seed=0):
    g=torch.Generator().manual_seed(seed); x=torch.randn(batch,steps,d,generator=g); cp=steps//2; x[:,cp:]+=1.5; return x,torch.full((batch,1),cp/steps)
def multimodal_binding(batch=16,steps=8,d=16,modalities=3,seed=0):
    g=torch.Generator().manual_seed(seed); base=torch.randn(batch,d,generator=g); return torch.stack([base+0.1*torch.randn(batch,d,generator=g)+.15*i for i in range(modalities)],1),base
