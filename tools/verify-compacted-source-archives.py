#!/usr/bin/env python3
"""Verify all compacted historical archive manifests without rebuilding ZIPs."""
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
MD=ROOT/'docs/archive-optimization/source-archive-manifests'
def sha(data): return hashlib.sha256(data).hexdigest()
def safe(rel):
 p=Path(rel)
 if p.is_absolute() or '..' in p.parts: raise ValueError(f'unsafe path: {rel}')
 q=(ROOT/p).resolve()
 if ROOT.resolve() not in q.parents: raise ValueError(f'path escapes project root: {rel}')
 return q
results=[]; errors=[]
for mp in sorted(MD.glob('*.manifest.json')):
 m=json.loads(mp.read_text(encoding='utf-8')); ok=0; total=0
 for e in m['entries']:
  total+=1; rel=e.get('blobPath') or e.get('canonicalPath')
  try:
   data=safe(rel).read_bytes()
   if len(data)!=e['sizeBytes'] or sha(data)!=e['sha256']: raise ValueError('size/hash mismatch')
   ok+=1
  except Exception as ex: errors.append({'manifest':mp.name,'member':e.get('path'),'source':rel,'error':str(ex)})
 results.append({'manifest':mp.name,'members':total,'verified':ok,'ok':ok==total,'originalArchiveBytes':m.get('originalArchiveBytes')})
out={'ok':not errors,'manifestCount':len(results),'members':sum(x['members'] for x in results),'verifiedMembers':sum(x['verified'] for x in results),'results':results,'errors':errors}
print(json.dumps(out,ensure_ascii=False,indent=2))
if errors: sys.exit(2)
