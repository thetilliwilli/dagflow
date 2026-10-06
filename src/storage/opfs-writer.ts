// Запись файла OPFS через воркер (используется, только если нет createWritable — риск R7)
export type FallbackWrite = (
  dir: FileSystemDirectoryHandle,
  name: string,
  text: string,
) => Promise<void>;

export function createOpfsWorkerWriter(): FallbackWrite {
  let worker: Worker | null = null;
  let seq = 0;
  const waiting = new Map<number, { resolve: () => void; reject: (e: Error) => void }>();

  function getWorker(): Worker {
    if (!worker) {
      worker = new Worker(new URL('./opfs-write-worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; error?: string }>) => {
        const w = waiting.get(e.data.id);
        waiting.delete(e.data.id);
        if (e.data.ok) w?.resolve();
        else w?.reject(new Error(e.data.error ?? 'Could not write the file.'));
      };
    }
    return worker;
  }

  return async (dir, name, text) => {
    const root = await navigator.storage.getDirectory();
    const path = await root.resolve(dir);
    if (!path) throw new Error('The folder is outside browser storage.');
    const id = ++seq;
    await new Promise<void>((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      getWorker().postMessage({ id, path: [...path, name], text });
    });
  };
}
