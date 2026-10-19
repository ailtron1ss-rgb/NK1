from __future__ import annotations
from pathlib import Path
import hashlib, json, torch

def save_checkpoint(model, path: str | Path, metadata: dict | None=None):
    path=Path(path); payload={'state_dict':model.state_dict(),'metadata':metadata or {}}
    torch.save(payload,path)
    sha=hashlib.sha256(path.read_bytes()).hexdigest()
    return {'path':str(path),'sha256':sha,'bytes':path.stat().st_size}

def load_checkpoint(model, path: str | Path, map_location='cpu'):
    payload=torch.load(path,map_location=map_location,weights_only=False)
    model.load_state_dict(payload['state_dict'])
    return payload.get('metadata',{})
