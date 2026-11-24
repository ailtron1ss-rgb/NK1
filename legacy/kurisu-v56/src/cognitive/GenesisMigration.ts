/**
 * V17 Genesis migration.
 * Ensures a new Kurisu starts without fabricated user history from older builds.
 * Canonical character knowledge is not deleted; only synthetic relationship/user
 * state produced by earlier prototypes is reset once.
 */
import { readJson, writeJson } from './StateVault';

const KEY = 'kurisu_genesis_migration_v17';
const VERSION = 1;

export function ensureV17Genesis() {
  const done = readJson<number>(KEY, 0);
  if (done >= VERSION) return false;

  const remove = [
    'kurisu_user_model_v1',
    'kurisu_narrative_v1',
    'kurisu_reflections_db',
    'kurisu_self_model_v1'
  ];
  for (const key of remove) {
    try { localStorage.removeItem(key); } catch { /* best effort */ }
  }

  // Remove only known prototype-seeded memory records; preserve genuine user memories.
  try {
    const raw = localStorage.getItem('kurisu_ltm_memory_db');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const filtered = list.filter((m: any) => !['mem_relationship_1'].includes(m?.id));
        localStorage.setItem('kurisu_ltm_memory_db', JSON.stringify(filtered));
      }
    }
  } catch { /* best effort */ }

  writeJson(KEY, VERSION);
  return true;
}
