import { MAX_AVATAR_MODEL_BYTES } from "./avatarModelLimits.ts";

export interface RemoteAvatarSource {
  readonly href: string;
  readonly filename: string;
}

export interface RemoteAvatarDownload {
  readonly blob: Blob;
  readonly filename: string;
  readonly sourceUrl: string;
  readonly byteLength: number;
}

export interface RemoteAvatarDownloadOptions {
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
  readonly maxBytes?: number;
  readonly timeoutMs?: number;
}

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(host);
  if (!match) return false;
  const [a, b, c] = match.slice(1).map(Number);
  if ([a, b, c, Number(match[4])].some((part) => part < 0 || part > 255)) return false;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
  if (!host) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.includes(":")) {
    if (host === "::" || host === "::1" || /^(fc|fd|fe[89ab]|ff)/u.test(host)) return true;
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(host);
    return mapped ? isPrivateIpv4(mapped[1]) : false;
  }
  return host === "localhost"
    || host === "local"
    || host === "internal"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".internal")
    || host.endsWith(".lan")
    || host.endsWith(".home.arpa");
}

/**
 * Resolve an externally hosted, self-contained VRM/GLB URL.
 * The browser downloads bytes only; model parsing still goes through the
 * existing size/complexity preflight before GLTFLoader receives them.
 */
export function validateRemoteAvatarUrl(input: string): RemoteAvatarSource {
  if (typeof input !== "string" || !input || input !== input.trim()) {
    throw new Error("Укажите HTTPS-ссылку на файл .vrm или .glb без пробелов по краям.");
  }

  if (input.length > 2048) throw new Error("Ссылка на модель слишком длинная.");

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Ссылка на модель имеет неверный формат.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Для удалённой модели разрешён только HTTPS.");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("Ссылка не должна содержать логин, пароль или fragment.");
  }
  if (isPrivateOrLocalHost(url.hostname)) {
    throw new Error("Локальные, приватные и служебные адреса для импорта запрещены.");
  }

  let filename: string;
  try {
    const lastSegment = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
    filename = decodeURIComponent(lastSegment)
      .replace(/[\u0000-\u001f\u007f]/gu, "")
      .replace(/[^A-Za-z0-9._-]/gu, "_")
      .slice(-180);
  } catch {
    throw new Error("Имя файла в ссылке закодировано неверно.");
  }
  if (!/\.(?:vrm|glb)$/iu.test(filename)) {
    throw new Error("Ссылка должна вести на файл с расширением .vrm или .glb.");
  }

  url.hash = "";
  return Object.freeze({ href: url.href, filename });
}

function parseContentLength(header: string | null, maxBytes: number): number | null {
  if (header === null) return null;
  if (!/^\d+$/u.test(header)) throw new Error("Сервер вернул некорректный Content-Length.");
  const value = Number(header);
  if (!Number.isSafeInteger(value) || value < 20) {
    throw new Error("Размер удалённой модели в заголовке некорректен.");
  }
  if (value > maxBytes) {
    throw new Error("Удалённая модель превышает лимит 90 МБ.");
  }
  return value;
}

export async function fetchRemoteAvatarModel(
  input: string,
  options: RemoteAvatarDownloadOptions = {},
): Promise<RemoteAvatarDownload> {
  const source = validateRemoteAvatarUrl(input);
  const maxBytes = options.maxBytes ?? MAX_AVATAR_MODEL_BYTES;
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 20 || maxBytes > MAX_AVATAR_MODEL_BYTES) {
    throw new Error("Лимит загрузки должен находиться в допустимом диапазоне до 90 МБ.");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new Error("Тайм-аут загрузки должен быть от 1 до 120000 мс.");
  }

  const fetcher = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("В этой среде недоступен Fetch API.");

  const controller = new AbortController();
  const callerSignal = options.signal;
  let timedOut = false;
  const relayAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) relayAbort();
  else callerSignal?.addEventListener("abort", relayAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    if (controller.signal.aborted) throw new Error("Загрузка модели отменена.");
    const response = await fetcher(source.href, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      headers: { Accept: "model/gltf-binary, application/octet-stream" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Сервер модели вернул HTTP " + response.status + ".");
    const declaredLength = parseContentLength(response.headers.get("content-length"), maxBytes);
    if (!response.body) throw new Error("Сервер не передал поток бинарных данных.");

    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      if (!(chunk instanceof Uint8Array)) throw new Error("Сервер передал неподдерживаемый формат данных.");
      total += chunk.byteLength;
      if (!Number.isSafeInteger(total) || total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Удалённая модель превышает лимит 90 МБ.");
      }
      chunks.push(chunk);
    }

    if (total < 20) throw new Error("Файл модели пустой или слишком короткий.");
    // Fetch may expose a decompressed stream while Content-Length describes wire bytes.
    // The header is only an early upper-bound hint; the streamed byte count is authoritative.

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return Object.freeze({
      blob: new Blob([bytes], { type: "application/octet-stream" }),
      filename: source.filename,
      sourceUrl: source.href,
      byteLength: total,
    });
  } catch (error) {
    if (timedOut) throw new Error("Время загрузки модели истекло.");
    if (callerSignal?.aborted) throw new Error("Загрузка модели отменена.");
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", relayAbort);
    try {
      reader?.releaseLock();
    } catch {
      // A cancelled stream may already have released its reader.
    }
  }
}
