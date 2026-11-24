from pathlib import Path
import pytest
from core.nomega.replay_partition_registry_v2 import ReplayPartitionRegistryV2, ImmutablePartitionError

def test_immutable_partition_rejects_changed_payload(tmp_path: Path):
    reg = ReplayPartitionRegistryV2(tmp_path)
    rows = [{'key':'h1','family':'sum3','x':1}]
    first = reg.register(rows, 'holdout', 'g1')
    assert first['fingerprint']
    again = reg.verify_immutable('holdout', rows)
    assert again['ok'] is True
    with pytest.raises(ImmutablePartitionError):
        reg.register([{'key':'h1','family':'sum3','x':2}], 'holdout', 'g2')

def test_train_generation_can_change(tmp_path: Path):
    reg = ReplayPartitionRegistryV2(tmp_path)
    reg.register([{'key':'t1','x':1}], 'train', 'g1')
    changed = reg.register([{'key':'t1','x':2}], 'train', 'g2')
    assert changed['generation'] == 'g2'
