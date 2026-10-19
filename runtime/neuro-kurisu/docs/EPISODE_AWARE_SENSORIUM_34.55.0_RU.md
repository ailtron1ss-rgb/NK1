# Episode-Aware Sensorium

P37 now derives a stable episode identity from scene, location, persistent entities and the current event label.

## Derived signals
- `episodeKey` — stable local episode identity
- `episodeBoundary01` — estimated boundary strength
- `crossModalEntityBinding01` — proportion of entities supported by multiple modalities

## Purpose
Prevent scheduler repetition from becoming fake life experience and provide a bounded temporal context for developmental learning.

## Limitations
Это инженерная эвристика event segmentation, а не утверждение о полном соответствии человеческой нейронауке.
