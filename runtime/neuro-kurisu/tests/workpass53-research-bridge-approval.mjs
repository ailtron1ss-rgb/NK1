import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const py=String.raw`
import importlib.util, json, sys
root=sys.argv[1]
spec=importlib.util.spec_from_file_location('kurisu_research_bridge',root+'/research/research_bridge.py')
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
calls=[]
tickets={}
def fake(path,payload):
    calls.append((path,payload))
    if path.endswith('/request'):
        ticket={'id':'approval-bridge-test','toolId':payload['id'],'toolInput':payload['toolInput']}
        tickets[ticket['id']]=ticket
        return {'ok':True,'approval':{'id':ticket['id'],'toolId':ticket['toolId'],'status':'pending','expiresAt':9999999999999,'inputPreview':ticket['toolInput']}}
    if path.endswith('/consume'):
        ticket=tickets.get(payload.get('approvalId'))
        ok=bool(ticket and ticket['toolId']==payload.get('id') and ticket['toolInput']==payload.get('toolInput'))
        if ok: tickets.pop(payload['approvalId'])
        return {'ok':ok,'reason':'approval-invalid' if not ok else None}
    return {'ok':False,'error':'unexpected-path'}
real_runtime_post=bridge.runtime_post
bridge.runtime_post=fake
blocked=bridge.authorize_probe('neurocore',None)
assert blocked['allowed'] is False and blocked['status']==403
assert blocked['body']['approvalRequired'] is True
assert blocked['body']['approvalRequest']['id']=='approval-bridge-test'
assert calls[0][1]['id']=='http.research.probe.neurocore'
assert calls[0][1]['toolInput']=={'kind':'neurocore'}
allowed=bridge.authorize_probe('neurocore','approval-bridge-test')
assert allowed['allowed'] is True
assert calls[-1][0].endswith('/consume') and calls[-1][1]['approvalId']=='approval-bridge-test'
invalid=bridge.authorize_probe('deepcode','approval-bridge-test')
assert invalid['allowed'] is False and invalid['status']==403
assert calls[-1][1]['id']=='http.research.probe.deepcode'
# The bridge must wait longer than the runtime's bounded 8s persistence-busy
# retry window, but keep ordinary runtime calls on the short timeout.
timeouts=[]
class FakeResponse:
    def __enter__(self): return self
    def __exit__(self, exc_type, exc, tb): return False
    def read(self): return b'{"ok":true}'
original_urlopen=bridge.urllib.request.urlopen
bridge.urllib.request.urlopen=lambda request, timeout: (timeouts.append((request.full_url, timeout)) or FakeResponse())
try:
    bridge.runtime_post=real_runtime_post
    approval_path='/api/organism/tools/permissions/request'
    assert bridge.runtime_post(approval_path,{})=={'ok':True}
    assert timeouts[-1][1]>=8, f'approval timeout too short for runtime retry window: {timeouts[-1][1]}'
    assert timeouts[-1][0].endswith(approval_path)
    bridge.runtime_post('/api/organism/chat',{})
    assert timeouts[-1][1]==4, 'ordinary requests retain their short timeout'
finally:
    bridge.urllib.request.urlopen=original_urlopen
print(json.dumps({'status':'pass','scenarios':10,'calls':len(calls),'approvalTimeoutSeconds':timeouts[0][1]}))
`;
const result=spawnSync('python3',['-c',py,root],{encoding:'utf8',timeout:10000});
assert.equal(result.status,0,`${result.stderr}\n${result.stdout}`);
const report=JSON.parse(result.stdout.trim());
assert.equal(report.status,'pass');
console.log(`WORKPASS53_RESEARCH_BRIDGE_APPROVAL=PASS scenarios=${report.scenarios}`);
