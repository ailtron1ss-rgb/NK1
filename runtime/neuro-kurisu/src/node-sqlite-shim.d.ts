declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(location: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    };
  }
}
