#!/usr/bin/env python3
"""Rebuild compacted historical ZIPs from verified path/hash manifests.

The rebuilt ZIP preserves every member path and member byte, but is not expected
 to be byte-for-byte identical to the original ZIP container.
"""
import argparse, hashlib, json, os, sys, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
MANIFEST_DIR = ROOT / 'docs' / 'archive-optimization' / 'source-archive-manifests'

def sha_bytes(data): return hashlib.sha256(data).hexdigest()
def safe_rel(rel):
    p=Path(rel)
    if p.is_absolute() or '..' in p.parts: raise ValueError(f'unsafe path in manifest: {rel}')
    resolved=(ROOT/p).resolve()
    if ROOT.resolve() not in resolved.parents and resolved != ROOT.resolve(): raise ValueError(f'path escapes project root: {rel}')
    return resolved

def source_bytes(entry):
    if entry.get('canonicalPath'):
        p=safe_rel(entry['canonicalPath']); data=p.read_bytes()
    elif entry.get('blobPath'):
        p=safe_rel(entry['blobPath']); data=p.read_bytes()
    else: raise ValueError(f"no source path for {entry.get('path')}")
    if sha_bytes(data) != entry['sha256'] or len(data) != entry['sizeBytes']:
        raise ValueError(f"source content mismatch for {entry.get('path')} (source={p})")
    return data

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--archive', help='select original archive basename, e.g. Kurisu_v9_Sprites_Live.zip')
    ap.add_argument('--overwrite', action='store_true', help='replace an existing archive at the target path')
    args=ap.parse_args()
    manifests=sorted(MANIFEST_DIR.glob('*.manifest.json'))
    if args.archive:
        manifests=[p for p in manifests if json.loads(p.read_text(encoding='utf-8')).get('originalArchivePath','').endswith('/'+args.archive) or json.loads(p.read_text(encoding='utf-8')).get('originalArchivePath','')==args.archive]
        if not manifests: raise SystemExit(f'no compacted archive manifest found for {args.archive}')
    results=[]
    for mp in manifests:
        m=json.loads(mp.read_text(encoding='utf-8')); target=safe_rel(m['originalArchivePath'])
        if target.exists() and not args.overwrite:
            results.append({'archive':m['originalArchivePath'],'status':'skipped-existing'}); continue
        target.parent.mkdir(parents=True,exist_ok=True)
        tmp=target.with_suffix(target.suffix+'.rebuilding')
        try:
            with zipfile.ZipFile(tmp,'w',allowZip64=True) as z:
                for d in m.get('directories',[]):
                    zi=zipfile.ZipInfo(d['path'],tuple(d.get('dateTime',[1980,1,1,0,0,0])))
                    zi.external_attr=d.get('externalAttr',0); zi.create_system=d.get('createSystem',3)
                    z.writestr(zi,b'')
                for e in m['entries']:
                    data=source_bytes(e)
                    zi=zipfile.ZipInfo(e['path'],tuple(e.get('dateTime',[1980,1,1,0,0,0])))
                    zi.compress_type=e.get('compressType',zipfile.ZIP_DEFLATED); zi.external_attr=e.get('externalAttr',0); zi.create_system=e.get('createSystem',3)
                    z.writestr(zi,data,compress_type=zi.compress_type,compresslevel=6)
            with zipfile.ZipFile(tmp,'r') as z:
                for e in m['entries']:
                    if sha_bytes(z.read(e['path'])) != e['sha256']:
                        raise ValueError(f"rebuilt archive content mismatch: {e['path']}")
            os.replace(tmp,target)
            results.append({'archive':m['originalArchivePath'],'status':'restored','members':len(m['entries']),'originalContainerSha256':m['originalArchiveSha256'],'rebuiltContainerIsByteIdentical':False,'bytes':target.stat().st_size})
        finally:
            if tmp.exists(): tmp.unlink()
    print(json.dumps({'ok':True,'results':results},ensure_ascii=False,indent=2))
if __name__=='__main__':
    try: main()
    except Exception as e:
        print(f'RESTORE_FAILED: {e}',file=sys.stderr); sys.exit(2)
