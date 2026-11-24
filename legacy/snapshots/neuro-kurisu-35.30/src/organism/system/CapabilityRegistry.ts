import { detectTermuxCapabilities } from '../body/AndroidEmbodimentBridge.ts';

export interface CapabilityRecord {
  id: string;
  available: boolean;
  source: 'core' | 'android' | 'network' | 'language' | 'simulation';
  reason: string;
  refreshedAt: number;
}

export interface CapabilitySnapshot {
  version: 1;
  features: CapabilityRecord[];
  refreshedAt: number;
}

const envBool = (key: string, fallback = false) => {
  const v = process.env[key];
  if (v == null) return fallback;
  return /^(1|true|yes|on)$/i.test(v);
};

export class CapabilityRegistry {
  private snapshotState: CapabilitySnapshot = { version: 1, features: [], refreshedAt: 0 };

  async refresh(): Promise<CapabilitySnapshot> {
    const now = Date.now();
    const termux = await detectTermuxCapabilities().catch(() => ({ battery:false, sensors:false, tts:false, stt:false, camera:false, wifi:false }));
    const anyTermux = Object.values(termux).some(Boolean);
    const features: CapabilityRecord[] = [
      { id: 'core.persistence', available: true, source: 'core', reason: 'canonical state store', refreshedAt: now },
      { id: 'core.replay', available: true, source: 'core', reason: 'deterministic event journal available', refreshedAt: now },
      { id: 'core.continuous_life', available: true, source: 'core', reason: 'persistent lifecycle, recovery and host-lineage engine', refreshedAt: now },
      { id: 'core.semantic_intelligence', available: true, source: 'core', reason: 'temporal semantic situations, provenance and action-relevant semantic state', refreshedAt: now },
      { id: 'core.semantic_perception', available: true, source: 'core', reason: 'bounded temporal perception graph, unresolved modality queue and action-relevant perception priorities', refreshedAt: now },
      { id: 'core.model_ecology', available: true, source: 'core', reason: 'resource-aware backend selection with observed runtime reliability', refreshedAt: now },
      { id: 'core.native_perception', available: true, source: 'core', reason: 'bounded local audio/image signal extraction with persisted provenance; semantic model backends remain optional', refreshedAt: now },
      { id: 'core.temporal_perception', available: true, source: 'core', reason: 'bounded online transition model over fused perceptual states with next-state prediction', refreshedAt: now },
      { id: 'core.unified_experience', available: true, source: 'core', reason: 'shared embodied experience representation joining perception, body, self and goals instead of a separate scene-decoder brain', refreshedAt: now },
      { id: 'core.representational_imagery', available: true, source: 'core', reason: 'bounded internal scene/workspace simulation grounded in perception, memory, prediction and self-location', refreshedAt: now },
      { id: 'core.embodied_predictive_world', available: true, source: 'core', reason: 'lightweight learned multi-step predictive state model coupled to action selection', refreshedAt: now },
      { id: 'android.termux_api', available: anyTermux || envBool('TERMUX_API_AVAILABLE', false), source: 'android', reason: anyTermux ? 'Termux:API commands detected' : (envBool('TERMUX_API_AVAILABLE', false) ? 'declared by runtime' : 'Termux:API not available'), refreshedAt: now },
      { id: 'android.battery', available: termux.battery, source: 'android', reason: termux.battery ? 'termux-battery-status detected' : 'battery API unavailable', refreshedAt: now },
      { id: 'android.sensors', available: termux.sensors, source: 'android', reason: termux.sensors ? 'termux-sensor detected' : 'sensor API unavailable', refreshedAt: now },
      { id: 'android.tts', available: termux.tts, source: 'android', reason: termux.tts ? 'termux-tts-speak detected' : 'TTS API unavailable', refreshedAt: now },
      { id: 'android.stt', available: termux.stt, source: 'android', reason: termux.stt ? 'termux-speech-to-text detected' : 'STT API unavailable', refreshedAt: now },
      { id: 'android.camera', available: termux.camera, source: 'android', reason: termux.camera ? 'termux-camera-info detected' : 'camera API unavailable', refreshedAt: now },
      { id: 'android.wifi', available: termux.wifi, source: 'android', reason: termux.wifi ? 'termux-wifi-connectioninfo detected' : 'Wi-Fi API unavailable', refreshedAt: now },
      { id: 'language.gemini', available: Boolean(process.env.GEMINI_API_KEY), source: 'language', reason: process.env.GEMINI_API_KEY ? 'API key present' : 'no API key', refreshedAt: now },
      { id: 'language.koboldcpp', available: Boolean(process.env.KOBOLD_URL), source: 'language', reason: process.env.KOBOLD_URL ? 'Kobold endpoint configured' : 'default/local endpoint not explicitly configured', refreshedAt: now },
      { id: 'world.simulation', available: true, source: 'simulation', reason: 'embedded deterministic environment', refreshedAt: now },
      { id: 'network', available: envBool('NETWORK_ONLINE', false), source: 'network', reason: envBool('NETWORK_ONLINE') ? 'declared online' : 'not asserted online', refreshedAt: now },
    ];
    this.snapshotState = { version: 1, features, refreshedAt: now };
    return this.snapshot();
  }

  snapshot(): CapabilitySnapshot { return structuredClone(this.snapshotState); }
  has(id: string): boolean { return this.snapshotState.features.find(x => x.id === id)?.available ?? false; }
}
