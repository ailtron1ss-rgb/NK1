from __future__ import annotations
from pathlib import Path
import json
import torch

from .autonomous_repair_learning_loop_v1 import AutonomousRepairLearningLoopV1
from .neural_substrate_v1 import ModernNeuralSubstrateV1
from .structural_plasticity_controller_v1 import StructuralPlasticityControllerV1


def _structural_evaluator(substrate):
    m = substrate.metrics()
    return -abs(float(m.mean_rate) - float(substrate.target_rate)) - 0.15 * float(m.energy_load) + 0.05 * float(m.active_synapse_fraction)


def run_benchmark(root: Path, seed: int = 31):
    root = Path(root)
    loop = AutonomousRepairLearningLoopV1(root, seed=seed)
    broken = [(0, 0, 0), (13, 0, 0), (14, 0, 0)]
    repair = loop.repair("sum3", broken, tapes=[[5, 0, 0, 0, 0, 0, 0, 0]], max_candidates=4)

    substrate = ModernNeuralSubstrateV1(5, exc_neurons=8, inh_neurons=4, seed=seed + 2)
    x = torch.randn(12, 5)
    substrate(x, reward=torch.ones(12), local_plasticity=True)
    controller = StructuralPlasticityControllerV1(seed=seed + 3)
    plan = controller.propose(substrate, max_prune=2, max_grow=2)
    tx = controller.apply_transaction(substrate, plan, evaluator=_structural_evaluator, min_gain=0.0)

    ckpt = root / "runtime" / "substrate_1_28_state.pt"
    ckpt.parent.mkdir(parents=True, exist_ok=True)
    torch.save(substrate.state_dict(), ckpt)
    restarted = ModernNeuralSubstrateV1(5, exc_neurons=8, inh_neurons=4, seed=999)
    restarted.load_state_dict(torch.load(ckpt, map_location="cpu", weights_only=False))
    restart_ok = torch.equal(substrate.synapse_mask, restarted.synapse_mask) and torch.allclose(substrate.recurrent, restarted.recurrent)

    report = {
        "version": "1.28.0-dev",
        "repair": repair,
        "structural": {"plan": plan.to_dict(), **tx.to_dict(), "restart_ok": bool(restart_ok)},
    }
    out = root / "runtime" / "nomega_1_28_autonomous_repair.json"
    out.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return report
