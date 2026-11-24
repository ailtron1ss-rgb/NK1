from __future__ import annotations
import time,torch
def profile(model,x,repeats=10):
    model.eval()
    with torch.no_grad(): model(x)
    t=time.perf_counter()
    with torch.no_grad():
        for _ in range(repeats): model(x)
    return {'avg_ms':(time.perf_counter()-t)*1000/repeats,'device':str(x.device),'threads':torch.get_num_threads()}
