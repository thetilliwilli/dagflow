// Где хранятся данные: рабочая папка (File System Access API) или OPFS (research R7, FR-028a…d)
import { get, set } from 'idb-keyval';
import { createOpfsWorkerWriter, type FallbackWrite } from './opfs-writer';

export type StorageLocation =
  | { kind: 'folder'; name: string }
  | { kind: 'folder-pending'; name: string }
  | { kind: 'browser' };

/** Окружение браузера; в тестах подменяется фейками. */
export interface LocationEnv {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  /** Запасная запись в OPFS без createWritable (риск R7). */
  opfsFallbackWrite?: FallbackWrite;
  getOpfsRoot: () => Promise<FileSystemDirectoryHandle>;
  loadHandle: () => Promise<FileSystemDirectoryHandle | undefined>;
  saveHandle: (handle: FileSystemDirectoryHandle) => Promise<void>;
}

const HANDLE_KEY = 'dagflow:folder';

export function browserEnv(): LocationEnv {
  const picker = typeof window !== 'undefined' ? window.showDirectoryPicker : undefined;
  return {
    showDirectoryPicker: picker ? () => picker.call(window, { mode: 'readwrite', id: 'dagflow' }) : undefined,
    opfsFallbackWrite: createOpfsWorkerWriter(),
    getOpfsRoot: () => navigator.storage.getDirectory(),
    loadHandle: () => get<FileSystemDirectoryHandle>(HANDLE_KEY),
    saveHandle: (h) => set(HANDLE_KEY, h),
  };
}

export interface Detected {
  location: StorageLocation;
  /** Для folder-pending — дескриптор папки, к содержимому которой ещё нельзя обращаться. */
  handle: FileSystemDirectoryHandle;
}

/** Хранилище браузера — подпапка `dagflow` в OPFS. */
export async function browserStorageHandle(env: LocationEnv): Promise<FileSystemDirectoryHandle> {
  const root = await env.getOpfsRoot();
  return root.getDirectoryHandle('dagflow', { create: true });
}

export async function detectLocation(env: LocationEnv): Promise<Detected> {
  if (env.showDirectoryPicker) {
    const saved = await env.loadHandle().catch(() => undefined);
    if (saved) {
      const permission = await saved.queryPermission({ mode: 'readwrite' }).catch(() => 'denied' as const);
      if (permission === 'granted') return { location: { kind: 'folder', name: saved.name }, handle: saved };
      if (permission === 'prompt') return { location: { kind: 'folder-pending', name: saved.name }, handle: saved };
    }
  }
  return { location: { kind: 'browser' }, handle: await browserStorageHandle(env) };
}

/** Запрос доступа к ранее выбранной папке; вызывать из обработчика клика. */
export async function restoreAccess(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/** Диалог выбора папки; null — пользователь отказался или API нет. */
export async function pickFolder(env: LocationEnv): Promise<FileSystemDirectoryHandle | null> {
  if (!env.showDirectoryPicker) return null;
  try {
    const handle = await env.showDirectoryPicker();
    await env.saveHandle(handle);
    return handle;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}
