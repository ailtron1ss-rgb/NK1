/**
 * Decide how the top-level supervisor reacts to a long-lived service exit.
 * Every launched child is mandatory; any unexpected exit leaves the system
 * only partially available and therefore triggers coordinated shutdown.
 */
export function decideSupervisedChildExit({ label, code, signal, shuttingDown }) {
  if (shuttingDown === true) {
    return { action: 'ignore', reason: 'supervisor-shutdown', message: '' };
  }

  const service = typeof label === 'string' && label.trim()
    ? label.trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
    : 'unknown-service';

  if (typeof signal === 'string' && signal.trim()) {
    const normalizedSignal = signal.trim().replace(/[^A-Z0-9_-]/gi, '').slice(0, 32) || 'unknown-signal';
    return {
      action: 'shutdown',
      reason: `child:${service}:${normalizedSignal}`,
      message: `[super] ${service} exited unexpectedly via ${normalizedSignal}`,
    };
  }

  if (code === 0) {
    return {
      action: 'shutdown',
      reason: `child:${service}:unexpected-zero-exit`,
      message: `[super] ${service} exited unexpectedly with code 0`,
    };
  }

  const exitCode = Number.isSafeInteger(code) ? String(code) : 'unknown';
  return {
    action: 'shutdown',
    reason: `child:${service}:exit-${exitCode}`,
    message: `[super] ${service} exited unexpectedly with code ${exitCode}`,
  };
}
