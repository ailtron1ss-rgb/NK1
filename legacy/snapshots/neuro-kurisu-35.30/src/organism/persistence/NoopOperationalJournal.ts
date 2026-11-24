export class NoopOperationalJournal {
  async write(_level: 'info'|'warn'|'error', _event: string, _data?: Record<string, unknown>): Promise<void> {}
}
