// Раскладка рабочего хранилища поверх FileSystemDirectoryHandle — одна реализация для папки и OPFS (research R7)
import type { CompositeDef, Workflow, Workspace } from '../engine';
import {
  compositeToFile,
  fileToComposite,
  fileToWorkflow,
  fileToWorkspace,
  toJsonText,
  workflowToFile,
  workspaceToFile,
} from '../model/serialize';
import type { FallbackWrite } from './opfs-writer';

export interface UnavailableItem {
  id: string;
  kind: 'workflow' | 'composite';
  reason: string;
}

export interface LoadedData {
  workspace: Workspace | null;
  workflows: Workflow[];
  composites: CompositeDef[];
  unavailable: UnavailableItem[];
}

const WORKSPACE = 'workspace.json';
const WORKFLOWS = 'workflows';
const COMPOSITES = 'composites';
const WORKFLOW_EXT = '.workflow.json';
const COMPOSITE_EXT = '.composite.json';

function isNotFound(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'NotFoundError';
}

export class DirectoryStorage {
  /** fallbackWrite — запись без createWritable (OPFS в браузерах без его поддержки, риск R7). */
  constructor(
    readonly handle: FileSystemDirectoryHandle,
    private readonly fallbackWrite?: FallbackWrite,
  ) {}

  get name(): string {
    return this.handle.name;
  }

  private async subdir(name: string, create: boolean): Promise<FileSystemDirectoryHandle | null> {
    try {
      return await this.handle.getDirectoryHandle(name, { create });
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  private async write(dir: FileSystemDirectoryHandle, name: string, data: unknown) {
    const file = await dir.getFileHandle(name, { create: true });
    const text = toJsonText(data);
    if (typeof file.createWritable === 'function') {
      const writable = await file.createWritable();
      await writable.write(text);
      await writable.close();
    } else if (this.fallbackWrite) {
      await this.fallbackWrite(dir, name, text);
    } else {
      throw new Error('Браузер не поддерживает запись файлов');
    }
  }

  private async remove(dirName: string, name: string) {
    const dir = await this.subdir(dirName, false);
    if (!dir) return;
    try {
      await dir.removeEntry(name);
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }

  private async readText(dir: FileSystemDirectoryHandle, name: string): Promise<string | null> {
    try {
      const file = await dir.getFileHandle(name);
      return await (await file.getFile()).text();
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  private async readAll<T>(
    dirName: string,
    ext: string,
    kind: UnavailableItem['kind'],
    decode: (data: unknown) => T,
    out: { items: T[]; unavailable: UnavailableItem[] },
  ) {
    const dir = await this.subdir(dirName, false);
    if (!dir) return;
    for await (const entry of dir.values()) {
      if (entry.kind !== 'file' || !entry.name.endsWith(ext)) continue; // посторонние файлы игнорируются
      const id = entry.name.slice(0, -ext.length);
      try {
        const text = await ((await (entry as FileSystemFileHandle).getFile()).text());
        out.items.push(decode(JSON.parse(text)));
      } catch (e) {
        const detail = e instanceof SyntaxError ? 'некорректный JSON' : (e as Error).message;
        out.unavailable.push({ id, kind, reason: `Файл повреждён: ${detail}` });
      }
    }
  }

  async loadAll(): Promise<LoadedData> {
    const text = await this.readText(this.handle, WORKSPACE);
    let workspace: Workspace | null = null;
    if (text !== null) {
      try {
        workspace = fileToWorkspace(JSON.parse(text));
      } catch {
        workspace = null; // повреждённый workspace.json: порядок восстановится из файлов workflow
      }
    }
    const workflows = { items: [] as Workflow[], unavailable: [] as UnavailableItem[] };
    const composites = { items: [] as CompositeDef[], unavailable: [] as UnavailableItem[] };
    await this.readAll(WORKFLOWS, WORKFLOW_EXT, 'workflow', fileToWorkflow, workflows);
    await this.readAll(COMPOSITES, COMPOSITE_EXT, 'composite', fileToComposite, composites);
    return {
      workspace,
      workflows: workflows.items,
      composites: composites.items,
      unavailable: [...workflows.unavailable, ...composites.unavailable],
    };
  }

  async hasData(): Promise<boolean> {
    if ((await this.readText(this.handle, WORKSPACE)) !== null) return true;
    const dir = await this.subdir(WORKFLOWS, false);
    if (!dir) return false;
    for await (const entry of dir.values()) if (entry.name.endsWith(WORKFLOW_EXT)) return true;
    return false;
  }

  async saveWorkflow(wf: Workflow) {
    await this.write((await this.subdir(WORKFLOWS, true))!, `${wf.id}${WORKFLOW_EXT}`, workflowToFile(wf));
  }

  async deleteWorkflow(id: string) {
    await this.remove(WORKFLOWS, `${id}${WORKFLOW_EXT}`);
  }

  async saveComposite(def: CompositeDef) {
    await this.write((await this.subdir(COMPOSITES, true))!, `${def.id}${COMPOSITE_EXT}`, compositeToFile(def));
  }

  async deleteComposite(id: string) {
    await this.remove(COMPOSITES, `${id}${COMPOSITE_EXT}`);
  }

  async saveWorkspace(ws: Workspace) {
    await this.write(this.handle, WORKSPACE, workspaceToFile(ws));
  }

  /** Записать всё переданное состояние (используется при переносе в пустое хранилище и при сбое). */
  async saveAll(data: { workspace: Workspace; workflows: Workflow[]; composites: CompositeDef[] }) {
    for (const wf of data.workflows) await this.saveWorkflow(wf);
    for (const c of data.composites) await this.saveComposite(c);
    await this.saveWorkspace(data.workspace);
  }

  /** Копирует содержимое в другое хранилище; только если оно пустое (FR-028c). */
  async copyTo(other: DirectoryStorage) {
    if (await other.hasData()) throw new Error('Хранилище назначения не пустое');
    const data = await this.loadAll();
    await other.saveAll({
      workspace: data.workspace ?? { workflowOrder: data.workflows.map((w) => w.id), tabs: [], activeTabId: null },
      workflows: data.workflows,
      composites: data.composites,
    });
  }
}
