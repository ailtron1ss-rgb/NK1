#!/usr/bin/env python3
"""Reconstruct the 2026-10-06 historical snapshot from WorkPass35 references.

Normal member bytes are hash-verified exactly. Nested compacted ZIPs are rebuilt
from their own member manifests, so their container bytes may differ while all
nested member bytes remain hash-verified.
"""
import argparse, hashlib, io, json, os, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
MANIFEST=ROOT/'docs/archive-optimization/historical-snapshot-2026-10-06.manifest.json'
def sha(data): return hashlib.sha256(data).hexdigest()
def safe(rel):
 p=Path(rel)
 if p.is_absolute() or '..' in p.parts: raise ValueError(f'unsafe path: {rel}')
 q=(ROOT/p).resolve()
 if ROOT.resolve() not in q.parents: raise ValueError(f'path escapes project root: {rel}')
 return q
def member_bytes(e):
 rel=e.get('blobPath') or e.get('canonicalPath')
 if not rel: raise ValueError(f"no byte source for {e.get('path')}")
 data=safe(rel).read_bytes()
 if len(data)!=e['sizeBytes'] or sha(data)!=e['sha256']: raise ValueError(f"source hash mismatch for {e['path']} from {rel}")
 return data
def zip_info(e):
 zi=zipfile.ZipInfo(e['path'],tuple(e.get('dateTime',[1980,1,1,0,0,0])))
 zi.compress_type=e.get('compressType',zipfile.ZIP_DEFLATED);zi.external_attr=e.get('externalAttr',0);zi.create_system=e.get('createSystem',3)
 return zi
def rebuild_nested(manifest_rel):
 m=json.loads(safe(manifest_rel).read_text(encoding='utf-8')); out=io.BytesIO()
 with zipfile.ZipFile(out,'w',allowZip64=True) as z:
  for d in m.get('directories',[]):
   zi=zipfile.ZipInfo(d['path'],tuple(d.get('dateTime',[1980,1,1,0,0,0])));zi.external_attr=d.get('externalAttr',0);zi.create_system=d.get('createSystem',3);z.writestr(zi,b'')
  for e in m['entries']:
   data=member_bytes(e);z.writestr(zip_info(e),data,compress_type=e.get('compressType',zipfile.ZIP_DEFLATED),compresslevel=6)
 with zipfile.ZipFile(io.BytesIO(out.getvalue())) as z:
  for e in m['entries']:
   if sha(z.read(e['path']))!=e['sha256']:raise ValueError(f"nested archive member mismatch: {m['originalArchivePath']}::{e['path']}")
 return out.getvalue()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',default='../Neuro_Kurisu_SUPER_FINAL_2026-10-06_UPDATED_REBUILT.zip');ap.add_argument('--check',action='store_true',help='verify all referenced content without writing the reconstructed snapshot');args=ap.parse_args()
 m=json.loads(MANIFEST.read_text(encoding='utf-8')); errors=[]; checked=0
 if args.check:
  for e in m['entries']:
   if e.get('nestedArchiveManifestRef'):
    nested=json.loads(safe(e['nestedArchiveManifestRef']).read_text(encoding='utf-8'))
    if nested.get('originalArchiveSha256')!=e['sha256']:errors.append(f"nested original hash metadata mismatch: {e['path']}")
    for ne in nested['entries']:
     try: member_bytes(ne);checked+=1
     except Exception as ex:errors.append(str(ex))
   else:
    try:member_bytes(e);checked+=1
    except Exception as ex:errors.append(str(ex))
  print(json.dumps({'ok':not errors,'mode':'check','members':len(m['entries']),'contentSourcesChecked':checked,'errors':errors[:50]},ensure_ascii=False,indent=2))
  if errors:sys.exit(2)
  return
 outpath=Path(args.output)
 if not outpath.is_absolute():outpath=(ROOT/outpath).resolve()
 if outpath.exists():raise SystemExit(f'output already exists; choose another path or remove it first: {outpath}')
 outpath.parent.mkdir(parents=True,exist_ok=True);tmp=outpath.with_suffix(outpath.suffix+'.building')
 try:
  with zipfile.ZipFile(tmp,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
   for d in m.get('directories',[]):
    zi=zipfile.ZipInfo(d['path'],tuple(d.get('dateTime',[1980,1,1,0,0,0])));zi.external_attr=d.get('externalAttr',0);zi.create_system=d.get('createSystem',3);z.writestr(zi,b'')
   for e in m['entries']:
    data=rebuild_nested(e['nestedArchiveManifestRef']) if e.get('nestedArchiveManifestRef') else member_bytes(e)
    z.writestr(zip_info(e),data,compress_type=e.get('compressType',zipfile.ZIP_DEFLATED),compresslevel=6)
  with zipfile.ZipFile(tmp) as z:
   bad=z.testzip()
   if bad:raise ValueError(f'outer ZIP CRC error: {bad}')
   for e in m['entries']:
    data=z.read(e['path'])
    if e.get('nestedArchiveManifestRef'):
     with zipfile.ZipFile(io.BytesIO(data)) as nz:
      nested=json.loads(safe(e['nestedArchiveManifestRef']).read_text(encoding='utf-8'))
      for ne in nested['entries']:
       if sha(nz.read(ne['path']))!=ne['sha256']:raise ValueError(f"nested member hash mismatch: {ne['path']}")
    elif sha(data)!=e['sha256']:raise ValueError(f"outer member hash mismatch: {e['path']}")
  os.replace(tmp,outpath)
  print(json.dumps({'ok':True,'output':str(outpath),'members':len(m['entries']),'originalContainerSha256':m['originalArchiveSha256'],'rebuiltContainerByteIdentical':False,'bytes':outpath.stat().st_size},ensure_ascii=False,indent=2))
 finally:
  if tmp.exists():tmp.unlink()
if __name__=='__main__':
 try:main()
 except Exception as e:print(f'HISTORICAL_RESTORE_FAILED: {e}',file=sys.stderr);sys.exit(2)
