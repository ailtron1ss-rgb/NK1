from __future__ import annotations
from pathlib import Path
import hashlib, json

def tree_sha256(root: str | Path):
    root=Path(root); rows=[]
    for p in sorted(x for x in root.rglob('*') if x.is_file() and '.pytest_cache' not in x.parts):
        h=hashlib.sha256(p.read_bytes()).hexdigest(); rows.append({'path':str(p.relative_to(root)),'sha256':h,'bytes':p.stat().st_size})
    return rows

def write_manifest(root: str|Path, output: str|Path):
    rows=tree_sha256(root); out=Path(output); out.write_text(json.dumps({'files':rows},indent=2),encoding='utf-8'); return out
