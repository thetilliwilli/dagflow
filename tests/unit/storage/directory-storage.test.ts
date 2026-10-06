import { describe, expect, it } from 'vitest';
import { DirectoryStorage } from '../../../src/storage/directory-storage';
import { toJsonText, workflowToFile } from '../../../src/model/serialize';
import type { CompositeDef, Workspace } from '../../../src/engine';
import { sampleWorkflow } from '../model/fixtures';
import { FakeDirectory } from './fake-directory';

const composite: CompositeDef = {
  id: 'c1',
  name: 'Удвоенная сумма',
  description: '',
  createdAt: '2026-10-05T12:00:00.000Z',
  updatedAt: '2026-10-05T12:00:00.000Z',
  graph: { nodes: [], edges: [] },
};
const workspace: Workspace = { workflowOrder: ['wf1'], tabs: [], activeTabId: null };

describe('DirectoryStorage', () => {
  it('раскладка файлов по контракту', async () => {
    const dir = new FakeDirectory();
    const s = new DirectoryStorage(dir.asHandle());
    await s.saveWorkflow(sampleWorkflow('wf1'));
    await s.saveComposite(composite);
    await s.saveWorkspace(workspace);
    expect(dir.paths()).toEqual(['composites/c1.composite.json', 'workflows/wf1.workflow.json', 'workspace.json']);
    expect(dir.file('workflows/wf1.workflow.json')!.content).toBe(toJsonText(workflowToFile(sampleWorkflow('wf1'))));
  });

  it('loadAll читает всё обратно', async () => {
    const dir = new FakeDirectory();
    const s = new DirectoryStorage(dir.asHandle());
    await s.saveWorkflow(sampleWorkflow('wf1'));
    await s.saveWorkflow(sampleWorkflow('wf2'));
    await s.saveComposite(composite);
    await s.saveWorkspace(workspace);
    const data = await s.loadAll();
    expect(data.workspace).toEqual(workspace);
    expect(data.workflows.map((w) => w.id).sort()).toEqual(['wf1', 'wf2']);
    expect(data.composites).toEqual([composite]);
    expect(data.unavailable).toEqual([]);
  });

  it('удаление файлов', async () => {
    const dir = new FakeDirectory();
    const s = new DirectoryStorage(dir.asHandle());
    await s.saveWorkflow(sampleWorkflow('wf1'));
    await s.saveComposite(composite);
    await s.deleteWorkflow('wf1');
    await s.deleteComposite('c1');
    await s.deleteWorkflow('missing'); // не падает
    expect(dir.paths()).toEqual([]);
  });

  it('посторонние файлы игнорируются, повреждённый workflow — «недоступен» с причиной', async () => {
    const dir = new FakeDirectory();
    const s = new DirectoryStorage(dir.asHandle());
    await s.saveWorkflow(sampleWorkflow('wf1'));
    dir.put('notes.txt', 'привет');
    dir.put('workflows/readme.md', '# readme');
    dir.put('workflows/bad.workflow.json', '{ broken');
    const data = await s.loadAll();
    expect(data.workflows.map((w) => w.id)).toEqual(['wf1']);
    expect(data.unavailable).toEqual([{ id: 'bad', kind: 'workflow', reason: expect.stringContaining('повреждён') }]);
  });

  it('workflow с нодом без имени (файл до фичи 002) — «недоступен» с причиной, остальные загружаются', async () => {
    const dir = new FakeDirectory();
    const s = new DirectoryStorage(dir.asHandle());
    await s.saveWorkflow(sampleWorkflow('wf1'));
    const old = JSON.parse(toJsonText(workflowToFile(sampleWorkflow('old'))));
    for (const n of old.graph.nodes) delete n.name;
    dir.put('workflows/old.workflow.json', toJsonText(old));
    const data = await s.loadAll();
    expect(data.workflows.map((w) => w.id)).toEqual(['wf1']);
    expect(data.unavailable).toEqual([
      { id: 'old', kind: 'workflow', reason: expect.stringContaining('graph.nodes.0.name') },
    ]);
  });

  it('пустое хранилище: loadAll и hasData', async () => {
    const s = new DirectoryStorage(new FakeDirectory().asHandle());
    expect(await s.hasData()).toBe(false);
    expect(await s.loadAll()).toEqual({ workspace: null, workflows: [], composites: [], unavailable: [] });
    await s.saveWorkflow(sampleWorkflow('wf1'));
    expect(await s.hasData()).toBe(true);
  });

  it('copyTo копирует только в пустое хранилище', async () => {
    const src = new DirectoryStorage(new FakeDirectory().asHandle());
    await src.saveWorkflow(sampleWorkflow('wf1'));
    await src.saveWorkspace(workspace);
    const dstDir = new FakeDirectory();
    await src.copyTo(new DirectoryStorage(dstDir.asHandle()));
    expect(dstDir.paths()).toEqual(['workflows/wf1.workflow.json', 'workspace.json']);
    await expect(src.copyTo(new DirectoryStorage(dstDir.asHandle()))).rejects.toThrow();
  });

  it('без createWritable пишет через запасной путь, а без него сообщает об ошибке (риск R7)', async () => {
    const dir = new FakeDirectory();
    dir.noCreateWritable = true;
    const writes: string[] = [];
    const s = new DirectoryStorage(dir.asHandle(), async (d, name, text) => {
      writes.push(`${d.name}/${name}`);
      expect(text).toContain('"format": "dagflow-workflow"');
    });
    await s.saveWorkflow(sampleWorkflow('wf1'));
    expect(writes).toEqual(['workflows/wf1.workflow.json']);
    const noFallback = new DirectoryStorage(dir.asHandle());
    await expect(noFallback.saveWorkspace(workspace)).rejects.toThrow('не поддерживает запись');
  });
});
