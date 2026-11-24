export interface MemoryStateStoreOptions<T> { initial?: T | null; }

export class MemoryStateStore<T> {
  private value: T | null;
  constructor(options: MemoryStateStoreOptions<T> = {}) { this.value = options.initial ?? null; }
  async load(): Promise<T | null> { return this.value == null ? null : structuredClone(this.value); }
  async save(value: T): Promise<void> { this.value = structuredClone(value); }
}
