type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogRow {
  at: number;
  level: Level;
  msg: string;
  meta?: string;
}

const KEY = 'kurisu_logs_v1';
const MAX = 200;

function load(): LogRow[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(rows: LogRow[]) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
}

export const logger = {
  log(level: Level, msg: string, meta?: unknown) {
    const rows = load();
    rows.unshift({
      at: Date.now(),
      level,
      msg: String(msg).slice(0, 300),
      meta: meta !== undefined ? String(meta).slice(0, 200) : undefined
    });
    save(rows);
    if (level === 'ERROR') console.error('[Kurisu]', msg, meta);
    else if (level === 'WARN') console.warn('[Kurisu]', msg, meta);
  },
  debug(m: string, meta?: unknown) {
    this.log('DEBUG', m, meta);
  },
  info(m: string, meta?: unknown) {
    this.log('INFO', m, meta);
  },
  warn(m: string, meta?: unknown) {
    this.log('WARN', m, meta);
  },
  error(m: string, meta?: unknown) {
    this.log('ERROR', m, meta);
  },
  list(n = 40) {
    return load().slice(0, n);
  },
  export(): string {
    return JSON.stringify(load(), null, 2);
  },
  clear() {
    localStorage.removeItem(KEY);
  }
};
