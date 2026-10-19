from core.nomega.neural_execution_learning_lab_v1 import NeuralExecutionLearningLabV1

def test_neural_lab_targets_primary_bottleneck(tmp_path):
    report = NeuralExecutionLearningLabV1(tmp_path, seed=71).run(['sum3'], hidden=24, epochs=2, preference_epochs=1)
    assert report.version == 'neural-execution-learning-lab-v2'
    assert report.experiment_id
    assert report.primary_bottleneck
    assert report.partitions['holdout'] >= 1
