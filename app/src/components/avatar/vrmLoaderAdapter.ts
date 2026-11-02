/**
 * vrmLoaderAdapter.ts
 *
 * Provides resilient loading and local IndexedDB caching for user-provided VRM/GLB models.
 * Supports external avatar URLs from VRoid Hub, GitHub, or custom CDN.
 */

export interface CachedModelMetadata {
  id: string;
  sourceUrl: string;
  byteLength: number;
  timestamp: number;
}

const DB_NAME = 'nk1_embodiment_cache';
const DB_VERSION = 1;
const STORE_NAME = 'models';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is unavailable in this environment'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function fetchWithIndexedDBCache(modelUrl: string): Promise<ArrayBuffer> {
  const modelId = encodeURIComponent(modelUrl);
  try {
    const db = await openDatabase();
    const cached = await new Promise<any>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(modelId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (cached && cached.data) {
      return cached.data as ArrayBuffer;
    }
  } catch (err) {
    console.warn('[vrmLoaderAdapter] IndexedDB cache read failed, falling back to direct network fetch:', err);
  }

  // Network fetch
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Failed to load 3D model from ${modelUrl}: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();

  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      id: modelId,
      sourceUrl: modelUrl,
      data: buffer,
      byteLength: buffer.byteLength,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('[vrmLoaderAdapter] IndexedDB cache write failed:', err);
  }

  return buffer;
}
