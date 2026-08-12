interface StoredSignature {
  id: string;
  name: string;
  imageData: string;
  createdAt: number;
}

const DB_NAME = 'pdfEditorDB';
const STORE_NAME = 'signatures';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSignature(name: string, imageData: string): Promise<StoredSignature> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const signature: Omit<StoredSignature, 'id'> = {
      name,
      imageData,
      createdAt: Date.now(),
    };
    const request = store.add(signature);
    request.onsuccess = () => {
      const result: StoredSignature = { ...signature, id: String(request.result) };
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSignatures(): Promise<StoredSignature[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = (request.result as StoredSignature[]).sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSignature(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(Number(id));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateSignatureName(id: string, name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(Number(id));
    request.onsuccess = () => {
      const data = request.result as StoredSignature;
      if (data) {
        data.name = name;
        store.put(data);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export type { StoredSignature };