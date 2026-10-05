// Запасная запись в OPFS для браузеров без FileSystemFileHandle.createWritable (риск R7):
// в воркере доступен синхронный доступ createSyncAccessHandle().
interface WriteRequest {
  id: number;
  path: string[];
  text: string;
}

interface SyncAccessHandle {
  truncate(size: number): void;
  write(data: Uint8Array, options?: { at?: number }): number;
  flush(): void;
  close(): void;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<WriteRequest>) => void) | null;
  postMessage(message: unknown): void;
};

scope.onmessage = async (e) => {
  const { id, path, text } = e.data;
  try {
    let dir = await navigator.storage.getDirectory();
    for (const name of path.slice(0, -1)) dir = await dir.getDirectoryHandle(name, { create: true });
    const file = await dir.getFileHandle(path[path.length - 1]!, { create: true });
    const handle = await (file as unknown as { createSyncAccessHandle(): Promise<SyncAccessHandle> }).createSyncAccessHandle();
    try {
      const data = new TextEncoder().encode(text);
      handle.truncate(0);
      handle.write(data, { at: 0 });
      handle.flush();
    } finally {
      handle.close();
    }
    scope.postMessage({ id, ok: true });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: (err as Error).message });
  }
};
