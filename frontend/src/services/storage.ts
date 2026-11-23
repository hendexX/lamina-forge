import { AssetRecord, BackendProvider } from '../types/studio';

const DB_NAME = 'lamina-forge-studio-db';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

const SETTINGS_KEY = 'lamina_forge_settings_v1';

export interface StoredSettings {
  provider: BackendProvider;
  apiUrl: string;
  falApiKey: string;
  geminiApiKey: string;
}

export function loadStoredSettings(): StoredSettings {
  const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000';
  const envFalKey = (import.meta.env.VITE_FAL_API_KEY as string | undefined) || '';
  const envGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredSettings>;
      return {
        provider: parsed.provider === 'fal' ? 'fal' : 'custom',
        apiUrl: parsed.apiUrl?.trim() || envApiUrl,
        falApiKey: parsed.falApiKey ?? envFalKey,
        geminiApiKey: parsed.geminiApiKey ?? envGeminiKey,
      };
    }
  } catch {
    // Ignore localStorage parse errors
  }

  return {
    provider: 'custom',
    apiUrl: envApiUrl,
    falApiKey: envFalKey,
    geminiApiKey: envGeminiKey,
  };
}

export function saveStoredSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAssetToDB(asset: AssetRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(asset);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAssetsFromDB(): Promise<AssetRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const items = (req.result as AssetRecord[]) || [];
      items.sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAssetFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
