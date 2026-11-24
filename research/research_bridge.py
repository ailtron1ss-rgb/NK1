#!/usr/bin/env python3
from __future__ import annotations

import json, os, sys, subprocess, traceback, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NC = ROOT / "research" / "neurocore-v143"
NOMEGA = ROOT / "research" / "nomega-pass20"
DEEP = ROOT / "research" / "deepcode" / "neurocore_organism_v21.py"
HOST = os.environ.get("RESEARCH_HOST", "127.0.0.1")
PORT = int(os.environ.get("RESEARCH_PORT", "8765"))
RUNTIME_API = os.environ.get("ORGANISM_RUNTIME_URL", "http://127.0.0.1:3310").rstrip("/")


def read_json(path: Path):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except Exception: return None


def status():
    nc = read_json(NC / "evidence" / "V143_STATUS.json") or {}
    return {
        "ok": True,
        "neurocore": {"version": str(nc.get("release", "1.43.0")), "evidence": nc, "mode": "research-only"},
        "nomega": {"version": "1.36.0-dev / Pass20", "forge": "pass20-capability-forge-v1", "registry": read_json(NOMEGA / "runtime" / "canonical_module_registry_v1.json"), "mode": "governed-research"},
        "deepcode": {"version": "NeuroCore Organism v21", "entrypoint": "smoke_test", "mode": "research-only"},
    }


def run_neurocore_probe():
    code = r'''
import json, sys, torch
sys.path.insert(0, sys.argv[1])
from neurocore.research.fwpkm_candidate import FastWeightProductKeyMemoryCandidate, FwPKMConfig
from neurocore.research.fwpkm_language_bridge import FwPKMLanguageBridge

torch.manual_seed(143)
cfg = FwPKMConfig(slots_per_subkey=32, value_dim=20, chunk_size=4)
mem = FastWeightProductKeyMemoryCandidate(cfg)
state = mem.initial_state(1, torch.device("cpu"), torch.float32)
q = torch.randn(1, 4, 16)
t = torch.randn(1, 4, 20)
flat_q = q.reshape(-1, 16)
flat_state = state.repeat_interleave(q.size(1), dim=0)
read_before, _, _ = mem.read(flat_q, flat_state)
state2, info = mem.rewrite_chunk(q, t, state)
flat_state2 = state2.repeat_interleave(q.size(1), dim=0)
read_after, _, _ = mem.read(flat_q, flat_state2)
bridge = FwPKMLanguageBridge(latent_dim=20)
bstate = bridge.initial_state(1, torch.device("cpu"), torch.float32)
latent = torch.randn(1, 3, 20)
rd, bstate2, binfo = bridge.sequence(latent, bstate, write_targets=latent, write=True)
print(json.dumps({"status":"pass","mse_before":float(((read_before-t.reshape(-1,20))**2).mean()),"mse_after":float(((read_after-t.reshape(-1,20))**2).mean()),"delta":float((((read_after-t.reshape(-1,20))**2).mean()-((read_before-t.reshape(-1,20))**2).mean())),"memory_state_bytes_fp32":mem.state_size*4,"bridge_dim":int(rd.shape[-1]),"bridge_info":binfo}))
'''
    r = subprocess.run([sys.executable, "-c", code, str(NC / "src")], text=True, capture_output=True, timeout=90)
    if r.returncode != 0: raise RuntimeError(r.stderr[-4000:])
    return {"ok": True, **json.loads(r.stdout)}


def run_nomega_registry():
    code = r'''
import json, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from core.nomega.canonical_registry_v1 import CanonicalModuleRegistryV1
report = CanonicalModuleRegistryV1(Path(sys.argv[1])).scan()
print(json.dumps({"status":"pass","total_modules":report.total_modules,"canonical_modules":report.canonical_modules,"research_modules":report.research_modules,"legacy_or_versioned_modules":report.legacy_or_versioned_modules,"consolidation_candidates":report.consolidation_candidates,"import_edges":report.import_edges,"cycles":len(report.cycles)}))
'''
    r = subprocess.run([sys.executable, "-c", code, str(NOMEGA)], text=True, capture_output=True, timeout=60)
    if r.returncode != 0: raise RuntimeError(r.stderr[-4000:])
    return {"ok": True, **json.loads(r.stdout)}


def run_deepcode():
    code = r'''
import json, importlib.util, sys
path=sys.argv[1]
spec=importlib.util.spec_from_file_location("deepcode_v21", path)
mod=importlib.util.module_from_spec(spec); sys.modules[spec.name]=mod; spec.loader.exec_module(mod)
result=mod.smoke_test(device="cpu")
print(json.dumps({"status":"pass","result":result}, default=str))
'''
    r = subprocess.run([sys.executable, "-c", code, str(DEEP)], text=True, capture_output=True, timeout=180)
    if r.returncode != 0: raise RuntimeError(r.stderr[-4000:])
    try:
        return {"ok": True, **json.loads(r.stdout)}
    except json.JSONDecodeError:
        marker = r.stdout.find('{\n  "steps":')
        if marker >= 0:
            end = r.stdout.find('\n\nCompleted in', marker)
            if end > marker:
                payload = json.loads(r.stdout[marker:end])
                return {"ok": True, "status": "pass", "result": payload}
        return {"ok": True, "status":"pass","raw":r.stdout[-8000:]}


def runtime_post(path: str, payload: dict):
    raw=json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request=urllib.request.Request(f"{RUNTIME_API}{path}", data=raw, headers={"content-type":"application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=4) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try: return json.loads(error.read().decode("utf-8"))
        except Exception: return {"ok":False,"error":f"runtime-http-{error.code}"}
    except Exception as error:
        return {"ok":False,"error":"runtime-approval-gateway-unavailable","detail":str(error)[:180]}


def authorize_probe(kind: str, approval_id: str | None):
    tool_id=f"http.research.probe.{kind}"
    tool_input={"kind":kind}
    if not approval_id:
        created=runtime_post("/api/organism/tools/permissions/request", {"id":tool_id,"toolInput":tool_input,"reason":f"research-probe-{kind}","operation":"direct"})
        ticket=created.get("approval") if isinstance(created,dict) else None
        if created.get("ok") and isinstance(ticket,dict):
            return {"allowed":False,"status":403,"body":{"ok":False,"approvalRequired":True,"error":"explicit-approval-required","approvalRequest":ticket}}
        return {"allowed":False,"status":503,"body":{"ok":False,"error":created.get("error","approval-gateway-unavailable")}}
    consumed=runtime_post("/api/organism/tools/permissions/consume", {"id":tool_id,"toolInput":tool_input,"approvalId":approval_id})
    if not consumed.get("ok"):
        return {"allowed":False,"status":403,"body":{"ok":False,"error":consumed.get("reason",consumed.get("error","approval-invalid")),"approvalRequired":False}}
    return {"allowed":True}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status_code, data):
        raw=json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status_code); self.send_header("content-type","application/json; charset=utf-8"); self.send_header("content-length",str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def _read_json(self):
        try:
            length=max(0,min(65536,int(self.headers.get("content-length","0"))))
            raw=self.rfile.read(length) if length else b"{}"
            value=json.loads(raw.decode("utf-8")) if raw else {}
            return value if isinstance(value,dict) else {}
        except Exception: return {}
    def do_GET(self):
        if self.path == "/health": self._send(200,{"ok":True,"service":"research-bridge"}); return
        if self.path == "/api/research/status": self._send(200,status()); return
        self._send(404,{"ok":False,"error":"not-found"})
    def do_POST(self):
        routes={"/api/research/probe/neurocore":("neurocore",run_neurocore_probe),"/api/research/probe/nomega-registry":("nomega-registry",run_nomega_registry),"/api/research/probe/deepcode":("deepcode",run_deepcode)}
        entry=routes.get(self.path)
        if not entry: self._send(404,{"ok":False,"error":"not-found"}); return
        kind,fn=entry
        payload=self._read_json()
        approval_id=str(payload.get("approvalId") or "").strip()[:120]
        gate=authorize_probe(kind, approval_id or None)
        if not gate.get("allowed"):
            self._send(int(gate.get("status",403)),gate.get("body",{"ok":False,"error":"approval-required"})); return
        try: self._send(200,fn())
        except Exception as e: self._send(500,{"ok":False,"error":str(e),"trace":traceback.format_exc(limit=4)})
    def log_message(self,*args): return

if __name__ == "__main__":
    print(f"[research-bridge] http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
