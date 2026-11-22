import type { NmcNRuntimeInput, NmcNRuntimePort } from './NmcNRuntimeBridge.ts';

/**
 * Explicit loopback-only HTTP transport for the optional Python NMCN sidecar.
 * No remote host, credentials, retries, process spawning or listener management.
 */
export class NmcNLocalHttpPort implements NmcNRuntimePort {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;

  constructor(
    endpoint = 'http://127.0.0.1:8765/evaluate',
    fetcher: typeof fetch = fetch,
  ) {
    const url = new URL(endpoint);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
        !url.port || url.pathname !== '/evaluate' || url.username || url.password ||
        url.search || url.hash) {
      throw new Error('nmcn-sidecar-endpoint-must-be-loopback-http-evaluate');
    }
    this.endpoint = url.toString();
    this.fetcher = fetcher;
  }

  async evaluate(input: NmcNRuntimeInput, options: { signal?: AbortSignal } = {}): Promise<unknown> {
    const response = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(input),
      signal: options.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`nmcn-sidecar-http-${response.status}`);
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > 65_536) {
      throw new Error('nmcn-sidecar-response-too-large');
    }
    const body = await response.text();
    if (body.length > 65_536) throw new Error('nmcn-sidecar-response-too-large');
    return JSON.parse(body);
  }
}
