from pathlib import Path
import torch
from core.nomega.neural_program_synth_v8 import NeuralProgramSynthesizerV8
from core.nomega.neural_program_trainer_v5 import AtomicProgramTrainerV5


def test_trainer_v5_scheduled_prefix_roundtrip(tmp_path):
    model = NeuralProgramSynthesizerV8(vocab=128, hidden=24, latent_dim=24, max_len=10, max_b=8, layers=1, heads=2, family_count=20)
    rows = [
        ("add the first two values", [(1,0,0),(1,1,1),(3,0,1),(14,0,0)], 0),
        ("xor three values", [(1,0,0),(1,1,1),(5,0,1),(14,0,0)], 1),
    ]
    trainer = AtomicProgramTrainerV5(model, seed=8501, lr=1e-3)
    report = trainer.fit(rows, epochs=2, batch_size=2, max_examples=2, scheduled_prefix_start=0.0, scheduled_prefix_end=0.5, scheduled_max_tokens=6)
    assert report.steps == 2
    assert report.scheduled_prefix_end == 0.5
    assert report.scheduled_tokens >= 0
    assert torch.isfinite(torch.cat([p.detach().reshape(-1) for p in model.parameters()])).all()
    path = Path(tmp_path) / "v5.pt"
    AtomicProgramTrainerV5.save(path, model, report)
    fresh, saved = AtomicProgramTrainerV5.load(path)
    assert fresh.__class__.__name__ == "NeuralProgramSynthesizerV8"
    assert saved["steps"] == 2
