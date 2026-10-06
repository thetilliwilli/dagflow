import { describe, expect, it } from 'vitest';
import { DirectoryStorage } from '../../../src/storage/directory-storage';
import { toJsonText, workflowToFile } from '../../../src/model/serialize';
import type { CompositeDef, Workspace } from '../../../src/engine';
import { sampleWorkflow } from '../model/fixtures';
import { FakeDirectory } from './fake-directory';
import { readFileSync } from 'node:fs';
import { createEvaluator } from '../../../src/engine/evaluator';
import { createRegistry } from '../../../src/engine/registry';

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
    expect(dir.paths()).toEqual([
      'composites/c1.composite.json',
      'workflows/wf1.workflow.json',
      'workspace.json',
    ]);
    expect(dir.file('workflows/wf1.workflow.json')!.content).toBe(
      toJsonText(workflowToFile(sampleWorkflow('wf1'))),
    );
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
    expect(data.unavailable).toEqual([
      { id: 'bad', kind: 'workflow', reason: 'The file is damaged: invalid JSON' },
    ]);
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
    expect(await s.loadAll()).toEqual({
      workspace: null,
      workflows: [],
      composites: [],
      unavailable: [],
    });
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
    await expect(noFallback.saveWorkspace(workspace)).rejects.toThrow(
      'The browser does not support writing files.',
    );
  });
});

describe('рабочая папка, сохранённая до фичи 003 (US3 #1, SC-005)', () => {
  // Те же данные, что в выгрузке для e2e: русские имена, в том числе имена по умолчанию из 002
  const legacy = JSON.parse(
    readFileSync(new URL('../../e2e/fixtures/legacy-002-export.json', import.meta.url), 'utf8'),
  );

  function legacyFolder() {
    const dir = new FakeDirectory();
    const wf = { ...legacy.workflow, name: 'Новый workflow' };
    const def = legacy.composites[0];
    dir.put(
      `workflows/${wf.id}.workflow.json`,
      JSON.stringify({ format: 'dagflow-workflow', version: 1, ...wf }, null, 2),
    );
    dir.put(
      `composites/${def.id}.composite.json`,
      JSON.stringify({ format: 'dagflow-composite', version: 1, ...def }, null, 2),
    );
    dir.put(
      'workspace.json',
      JSON.stringify({
        format: 'dagflow-workspace',
        version: 1,
        workflowOrder: [wf.id],
        tabs: [],
        activeTabId: null,
      }),
    );
    return dir;
  }

  it('читается без недоступных файлов, имена — посимвольно прежние', async () => {
    const data = await new DirectoryStorage(legacyFolder().asHandle()).loadAll();
    expect(data.unavailable).toEqual([]);
    expect(data.workflows.map((w) => w.name)).toEqual(['Новый workflow']);
    expect(data.workflows[0]!.graph.nodes.map((n) => n.name)).toEqual([
      'Число',
      'Число',
      'Сложить',
      'Показать',
      'Удвоить',
    ]);
    expect(data.composites.map((c) => c.name)).toEqual(['Удвоить']);
    expect(
      data.composites[0]!.graph.nodes.flatMap((n) => n.ports ?? []).map((p) => p.name),
    ).toEqual(['x', 'результат']);
  });

  it('вычисляется с теми же значениями', async () => {
    const data = await new DirectoryStorage(legacyFolder().asHandle()).loadAll();
    const ev = createEvaluator((c) => createRegistry(c));
    ev.setGraph(data.workflows[0]!.graph, data.composites);
    ev.flush();
    expect(ev.state('show').inputs).toEqual({ value: 5 });
    expect(ev.state('dbl')).toMatchObject({ status: 'ok', outputs: { результат: 10 } });
  });
});
