import type { BodyTelemetry } from './EmbodiedBody.ts';

export interface AndroidTelemetryObservationInput {
  id: string;
  sourceId: string;
  sourceKind: string;
  modality: 'device';
  capturedAt: number;
  confidence01: number;
  reliability01: number;
  sessionId: string;
  provenance: 'host-interface';
  payload: Record<string, unknown>;
}

export interface AndroidTelemetryAdapterInput {
  telemetry: BodyTelemetry;
  previousSampledAt: number;
  requestedSensors: readonly string[];
  consentGranted: boolean;
  sessionId: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const format = (value: number | boolean): string => typeof value === 'number' ? String(Number(value.toFixed(4))) : (value ? 'online' : 'offline');

/**
 * Project only a fresh Android-host sample and only the sensors requested by
 * active perception. This adapter is called after EmbodimentRuntime has sampled
 * the Termux host bridge; simulated and stale telemetry never becomes evidence.
 * Capture requires the user's explicit device consent.
 */
export function buildAndroidTelemetryObservation(
  input: AndroidTelemetryAdapterInput,
): AndroidTelemetryObservationInput | null {
  const telemetry = input?.telemetry;
  if (!input || input.consentGranted !== true ||
      !telemetry || telemetry.source !== 'android-termux' || telemetry.staleMs !== 0 ||
      !finite(telemetry.sampledAt) || telemetry.sampledAt < 0 ||
      !finite(input.previousSampledAt) || input.previousSampledAt < 0 ||
      telemetry.sampledAt <= input.previousSampledAt ||
      typeof input.sessionId !== 'string' || !input.sessionId.trim() || input.sessionId.length > 128 ||
      !Array.isArray(input.requestedSensors)) return null;

  const requested = new Set(input.requestedSensors.filter((sensor): sensor is string =>
    typeof sensor === 'string' &&
    ['battery', 'thermal', 'motion', 'light', 'proximity', 'network'].includes(sensor)));
  const payload: Record<string, unknown> = { subject: 'android-device-telemetry' };
  const claims: string[] = [];

  if (requested.has('battery') && finite(telemetry.battery01)) {
    const value = clamp01(telemetry.battery01);
    payload.battery01 = value;
    claims.push('battery=' + format(value));
  }
  if (requested.has('thermal')) {
    if (finite(telemetry.batteryTemperatureC)) {
      payload.batteryTemperatureC = telemetry.batteryTemperatureC;
      claims.push('temperatureC=' + format(telemetry.batteryTemperatureC));
    }
    if (finite(telemetry.thermalPressure01)) {
      const value = clamp01(telemetry.thermalPressure01);
      payload.thermalPressure01 = value;
      claims.push('thermal=' + format(value));
    }
  }
  if (requested.has('motion') && finite(telemetry.motion01)) {
    const value = clamp01(telemetry.motion01);
    payload.motion01 = value;
    claims.push('motion=' + format(value));
  }
  if (requested.has('light') && finite(telemetry.ambientLight01)) {
    const value = clamp01(telemetry.ambientLight01);
    payload.ambientLight01 = value;
    claims.push('light=' + format(value));
  }
  if (requested.has('proximity') && finite(telemetry.proximity01)) {
    const value = clamp01(telemetry.proximity01);
    payload.proximity01 = value;
    claims.push('proximity=' + format(value));
  }
  if (requested.has('network') && typeof telemetry.networkOnline === 'boolean') {
    payload.networkOnline = telemetry.networkOnline;
    claims.push('network=' + format(telemetry.networkOnline));
  }

  if (claims.length === 0) return null;
  payload.claim = claims.join(';');

  return {
    id: 'android-telemetry:' + Math.floor(telemetry.sampledAt),
    sourceId: 'android-termux-primary',
    sourceKind: 'android-telemetry',
    modality: 'device',
    capturedAt: telemetry.sampledAt,
    confidence01: 0.85,
    reliability01: 0.65,
    sessionId: input.sessionId,
    provenance: 'host-interface',
    payload,
  };
}
