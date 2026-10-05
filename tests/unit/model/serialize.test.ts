import { describe, expect, it } from 'vitest';
import {
  buildExport,
  fileToWorkflow,
  fileToWorkspace,
  FormatError,
  toJsonText,
  workflowToFile,
  workspaceToFile,
} from '../../../src/model/serialize';
import type { Workspace } from '../../../src/engine';
import { sampleWorkflow } from './fixtures';

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

  it('имя длиннее 100 символов отклоняется', () => {
    const file = { ...workflowToFile(sampleWorkflow()), name: 'x'.repeat(101) };
    expect(() => fileToWorkflow(file)).toThrow(FormatError);
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
