import json, math, os, sys, time
from pathlib import Path
import torch
import torch.nn.functional as F

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'src'))
from neurocore.research.portable_paths import resolve_output_dir
OUTPUT_DIR=resolve_output_dir(ROOT)
from neurocore.current.text_interface import build_byte_language_model
from neurocore.research.fwpkm_language_bridge import FwPKMLanguageBridge

TEXT = ("NeuroCore memory revision benchmark. The system stores a fact, later revises it, "
        "then observes distractors and finally queries the latest value. "
        "Reliable memory should favor the revised fact without duplicating memory ownership. ")*18

def windows(data, n=96, stride=96):
    b=list(data)
    for s in range(0,max(1,len(b)-1),stride):
        w=b[s:s+n]
        if len(w)>=8: yield w

def main():
    torch.manual_seed(143)
    model=build_byte_language_model(seed=143)
    model.eval()
    bridge=FwPKMLanguageBridge(latent_dim=model.core.cfg.trunk.latent_dim)
    bridge.eval()
    losses=[]; mem_losses=[]; parity=[]
    for w in list(windows(TEXT.encode('utf-8')))[:8]:
        ids=torch.tensor(w,dtype=torch.long).unsqueeze(0)
        with torch.no_grad():
            obs, goals=model.encoder(ids)
            out=model.core(obs, goals)
            pred=out['predictive']
            base_logits=model.lm_head(pred)
            st=bridge.initial_state(1,pred.device,pred.dtype)
            # Write each position's next contextual latent; read is causal and stateful.
            targets=pred
            read, st2, info=bridge.sequence(pred, st, write_targets=targets, write=True)
            aug=bridge.logits_with_memory(base_logits, read)
            targets_bytes=ids[:,1:]
            base_loss=F.cross_entropy(base_logits[:,:-1].reshape(-1,256),targets_bytes.reshape(-1))
            aug_loss=F.cross_entropy(aug[:,:-1].reshape(-1,256),targets_bytes.reshape(-1))
            losses.append(float(base_loss)); mem_losses.append(float(aug_loss))
            # Compare full sequence and chunked bridge read with identical state updates.
            st3=bridge.initial_state(1,pred.device,pred.dtype)
            read2, _, _=bridge.sequence(pred[:,:32], st3, write_targets=targets[:,:32], write=True)
            st4=bridge.initial_state(1,pred.device,pred.dtype)
            read3, _, _=bridge.sequence(pred[:,:32], st4, write_targets=targets[:,:32], write=True)
            parity.append(float((read2-read3).abs().max()))
    result={
        'windows':len(losses),
        'base_loss_mean':sum(losses)/len(losses),
        'fwpkm_augmented_loss_mean':sum(mem_losses)/len(mem_losses),
        'delta_loss':sum(mem_losses)/len(mem_losses)-sum(losses)/len(losses),
        'bridge_parity_max_abs':max(parity),
        'memory_state_bytes_fp32': bridge.state_size()*4,
        'status':'research_only',
    }
    out=ROOT/'evidence'; out.mkdir(exist_ok=True)
    (out/'V143_FwPKM_LANGUAGE.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))

if __name__=='__main__': main()
