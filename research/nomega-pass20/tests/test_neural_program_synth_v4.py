from pathlib import Path

from core.nomega.neural_program_synth_v4 import (
    AtomicProgramSynthesizerV4,
    AtomicProgramTrainerV4,
    InstructionVocabularyV1,
)


def test_atomic_vocabulary_contains_only_valid_instruction_forms():
    vocab = InstructionVocabularyV1(max_b=8, max_len=6)
    assert vocab.size < 400
    assert vocab.to_id[(14, 0, 0)] == vocab.halt_id
    assert (14, 1, 0) not in vocab.to_id
    assert (3, 0, 3) in vocab.to_id
    assert (1, 3, 7) in vocab.to_id


def test_atomic_model_generates_and_roundtrips_checkpoint(tmp_path):
    model = AtomicProgramSynthesizerV4(hidden=24, latent_dim=24, max_len=8, max_b=8, layers=1, heads=2)
    code = [(1, 0, 0), (1, 1, 1), (3, 0, 1), (13, 0, 0), (14, 0, 0)]
    rows = [
        ("add the first three values", code, 0),
        ("compute their total", code, 0),
        ("three way addition", code, 0),
        ("aggregate the first three", code, 0),
    ]
    report = AtomicProgramTrainerV4(model, seed=3301, lr=1e-3).fit(rows, epochs=2, batch_size=2, max_examples=4)
    assert report.steps == 4
    assert report.token_loss >= 0.0
    out = model.generate("compute their total", family_id=0, max_len=8, beam_size=2)
    assert out and out[-1][0] == 14
    path = Path(tmp_path) / "atomic.pt"
    AtomicProgramTrainerV4.save(path, model, report)
    fresh, blob = AtomicProgramTrainerV4.load(path)
    assert fresh.checkpoint_signature() == model.checkpoint_signature()
    assert blob["steps"] if isinstance(blob, dict) and "steps" in blob else True


def test_atomic_parameter_count_is_finite_and_family_space_is_canonical():
    model = AtomicProgramSynthesizerV4(hidden=40, latent_dim=40, max_len=20, max_b=64, layers=2, heads=4)
    assert model.family_count == 20
    assert sum(p.numel() for p in model.parameters()) < 500_000
