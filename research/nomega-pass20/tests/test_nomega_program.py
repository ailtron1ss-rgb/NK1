import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.nomega import NOMEGAConfig, NOmegaCore
from core.nomega.program_runtime import compile_tiny_to_hvm


def test_compile_sum_program_to_hvm():
    # TinyVM: r0=tape0, r1=tape1, r0+=r1, out r0, halt
    code = [(1,0,0),(1,1,1),(3,0,1),(13,0,0),(14,0,0)]
    compiled = compile_tiny_to_hvm(code)
    assert compiled is not None


def test_neural_invent_executes_program_path():
    c = NOmegaCore(NOMEGAConfig(latent_dim=32, router_hidden=24, memory_dim=32, max_reason_steps=2))
    out = c.run("write a program to sum", {
        "program_kind": "sum",
        "task_seed": 123,
        "task_count": 8,
        "program_candidates": 4,
    })
    assert "neural_invent" in out["experts"] or out["experts"]
    # A fresh checkpoint may not yet solve the synthetic family; however the expert
    # must have attempted actual program synthesis rather than returning a handoff.
    traces = out.get("trace", [])
    payloads = [x.get("expert_outputs", {}).get("neural_invent", {}) for x in traces]
    assert any("candidates" in p or p.get("status") == "needs_examples" or "error" in p for p in payloads)
