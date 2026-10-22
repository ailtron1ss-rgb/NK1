import { createHash } from 'node:crypto';
import { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';

interface StoredLedgerEnvelope {
  format: 'neuro-kurisu-verified-outcome-ledger';
  formatVersion: 1;
  payload: ReturnType<VerifiedOutcomeLedger['snapshot']>;
  sha256: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function digest(payload: unknown): string {
  return createHash('sha256').update(canonical(payload)).digest('hex');
}

/** JSON codec with a checksum for corruption detection; not a signature/authentication scheme. */
export function serializeVerifiedOutcomeLedger(ledger: VerifiedOutcomeLedger): string {
  const payload = ledger.snapshot();
  const envelope: StoredLedgerEnvelope = {
    format: 'neuro-kurisu-verified-outcome-ledger',
    formatVersion: 1,
    payload,
    sha256: digest(payload),
  };
  return JSON.stringify(envelope, null, 2) + '\n';
}

/** Restore only after envelope integrity and every accepted outcome are revalidated. */
export function restoreVerifiedOutcomeLedger(serialized: string): VerifiedOutcomeLedger {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('ledger persistence is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid ledger persistence envelope');
  const envelope = parsed as Partial<StoredLedgerEnvelope>;
  if (envelope.format !== 'neuro-kurisu-verified-outcome-ledger' || envelope.formatVersion !== 1 ||
      !envelope.payload || typeof envelope.sha256 !== 'string') {
    throw new Error('unsupported or malformed ledger persistence envelope');
  }
  if (!/^[a-f0-9]{64}$/.test(envelope.sha256) || digest(envelope.payload) !== envelope.sha256) {
    throw new Error('ledger persistence checksum mismatch');
  }
  return VerifiedOutcomeLedger.restoreSnapshot(envelope.payload);
}
