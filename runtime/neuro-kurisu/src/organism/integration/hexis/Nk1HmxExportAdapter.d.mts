export interface Nk1HmxExportOptions {
  intent?: 'port' | 'duplicate' | 'telepathy' | 'analysis';
}
export declare function normalizeNk1HmxExport(
  nativeDocument: Record<string, unknown>,
  options?: Nk1HmxExportOptions
): Record<string, any>;
