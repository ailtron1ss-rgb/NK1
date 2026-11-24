from pathlib import Path
import numpy as np

def test_dataset_shards():
 p=next(Path('datasets/v16').glob('*.npz')); z=np.load(p); assert z['x'].shape==(1024,64,16); assert z['y'].shape==(1024,16); assert z['x'].dtype==np.float16

def test_dataset_count(): assert len(list(Path('datasets/v16').glob('*.npz'))) >= 32
