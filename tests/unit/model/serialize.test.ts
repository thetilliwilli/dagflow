import { describe, expect, it } from 'vitest';
import {
  buildExport,
  compositeToFile,
  fileToComposite,
  fileToWorkflow,
  fileToWorkspace,
  FormatError,
  toJsonText,
  workflowToFile,
  workspaceToFile,
} from '../../../src/model/serialize';
import type { Workspace } from '../../../src/engine';
import { sampleWorkflow } from './fixtures';
import { doubleSum } from '../engine/composite-fixtures';

describe('сериализация workflow', () => {
  it('workflow → JSON → workflow даёт глубоко равный объект (SC-005)', () => {
    const wf = sampleWorkflow();
    const text = toJsonText(workflowToFile(wf));
    expect(fileToWorkflow(JSON.parse(text))).toEqual(wf);
  });

  it('формат файла соответствует контракту', () => {
    const file = workflowToFile(sampleWorkflow());
    expect(file).toMatchObject({ format: 'dagflow-workflow', version: 1, id: 'wf1', name: 'Пример' });
    const text = toJsonText(file);
    expect(text.startsWith('{\n  "format": "dagflow-workflow",\n  "version": 1,')).toBe(true);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('некорректный файл → FormatError с путём к полю', () => {
    const file = workflowToFile(sampleWorkflow()) as unknown as Record<string, unknown>;
    file.name = '';
    expect(() => fileToWorkflow(file)).toThrow(FormatError);
    expect(() => fileToWorkflow(file)).toThrow(/name/);
  });
});

describe('имя нода в файле (FR-009, FR-010, contracts/file-formats.md 002)', () => {
  type NodeObj = Record<string, unknown>;
  const nodesOf = (file: unknown) => (file as { graph: { nodes: NodeObj[] } }).graph.nodes;

  it('ключи нода идут в порядке id, type, name, position, values, ports', () => {
    const wf = sampleWorkflow();
    // Нод собран в «неудобном» порядке ключей — в файле порядок всё равно по контракту
    wf.graph.nodes[0] = { values: { value: 2 }, position: { x: 0, y: 0 }, name: 'Number', type: 'builtin:number', id: 'n1' };
    const text = toJsonText(workflowToFile(wf));
    const keys = Object.keys(nodesOf(JSON.parse(text))[0]!);
    expect(keys).toEqual(['id', 'type', 'name', 'position', 'values']);
    const io = toJsonText(
      workflowToFile({
        ...wf,
        graph: { nodes: [{ ports: [], values: {}, position: { x: 0, y: 0 }, name: 'Input', type: 'builtin:input', id: 'i' }], edges: [] },
      }),
    );
    expect(Object.keys(nodesOf(JSON.parse(io))[0]!)).toEqual(['id', 'type', 'name', 'position', 'values', 'ports']);
  });

  it('имена нодов переживают запись и чтение (SC-007)', () => {
    const wf = sampleWorkflow();
    expect(fileToWorkflow(JSON.parse(toJsonText(workflowToFile(wf)))).graph.nodes.map((n) => n.name)).toEqual(
      wf.graph.nodes.map((n) => n.name),
    );
  });

  it('нод без имени или с пустым именем — FormatError с путём к полю', () => {
    const cases: Array<(n: NodeObj) => void> = [
      (n) => delete n.name,
      (n) => (n.name = ''),
      (n) => (n.name = '   '),
    ];
    for (const mutate of cases) {
      const file = JSON.parse(toJsonText(workflowToFile(sampleWorkflow())));
      mutate(nodesOf(file)[0]!);
      expect(() => fileToWorkflow(file)).toThrow(FormatError);
      expect(() => fileToWorkflow(file)).toThrow(/graph\.nodes\.0\.name/);
    }
  });

  it('имя обрезается по краям', () => {
    const file = JSON.parse(toJsonText(workflowToFile(sampleWorkflow())));
    nodesOf(file)[0]!.name = '  Number  ';
    expect(fileToWorkflow(file).graph.nodes[0]!.name).toBe('Number');
  });
});

describe('сериализация workspace', () => {
  it('workspace.json сериализуется и читается', () => {
    const ws: Workspace = {
      workflowOrder: ['a', 'b'],
      tabs: [{ id: 't1', kind: 'workflow', targetId: 'a', viewport: { x: 1, y: 2, zoom: 1.5 } }],
      activeTabId: 't1',
    };
    const file = workspaceToFile(ws);
    expect(file).toMatchObject({ format: 'dagflow-workspace', version: 1 });
    expect(fileToWorkspace(JSON.parse(toJsonText(file)))).toEqual(ws);
  });
});

describe('выгрузка', () => {
  it('файл выгрузки содержит workflow и определения', () => {
    const wf = sampleWorkflow();
    const exp = buildExport(wf, [], '2026-10-05T12:10:00.000Z');
    expect(exp).toEqual({ format: 'dagflow-export', version: 1, exportedAt: '2026-10-05T12:10:00.000Z', workflow: wf, composites: [] });
  });
});

describe('имена на разных языках (003: US2 #3, SC-004)', () => {
  const names = ['Итого', '合計', '日本語の名前', 'مجموع', 'Résumé 📈', '👨‍👩‍👧 семья'];
  const roundTrip = <T>(toFile: (x: T) => unknown, fromFile: (d: unknown) => T, x: T) =>
    fromFile(JSON.parse(toJsonText(toFile(x))));

  it('имена workflow и нодов совпадают посимвольно после записи и чтения', () => {
    for (const name of names) {
      const wf = sampleWorkflow();
      wf.name = name;
      wf.graph.nodes[0]!.name = name;
      const back = roundTrip(workflowToFile, fileToWorkflow, wf);
      expect(back.name).toBe(name);
      expect(back.graph.nodes[0]!.name).toBe(name);
    }
  });

  it('имена составного нода и его портов совпадают посимвольно после записи и чтения', () => {
    for (const name of names) {
      const def = doubleSum();
      def.name = name;
      def.graph.nodes[0]!.ports![0]!.name = name;
      def.graph.edges[0]!.source.port = name;
      const back = roundTrip(compositeToFile, fileToComposite, def);
      expect(back.name).toBe(name);
      expect(back.graph.nodes[0]!.ports![0]!.name).toBe(name);
    }
  });
});
