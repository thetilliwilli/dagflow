import { describe, expect, it } from 'vitest';
import { importExport, type ImportContext } from '../../../src/model/import';
import { buildExport, toJsonText } from '../../../src/model/serialize';
import { sampleWorkflow } from './fixtures';

function ctx(): ImportContext {
  let seq = 0;
  return {
    workflows: { wf1: sampleWorkflow('wf1') },
    composites: {},
    newId: () => `new${++seq}`,
    now: () => '2026-10-05T13:00:00.000Z',
  };
}

function exportText(mutate?: (e: Record<string, unknown>) => void): string {
  const e = buildExport(sampleWorkflow('wf1'), [], '2026-10-05T12:10:00.000Z') as unknown as Record<
    string,
    unknown
  >;
  mutate?.(e);
  return toJsonText(e);
}

function fail(text: string, c = ctx()): string {
  const before = JSON.stringify(c);
  const r = importExport(text, c);
  expect(JSON.stringify(c)).toBe(before); // FR-030: входное состояние не изменено
  if (r.ok) throw new Error('ожидалась ошибка');
  return r.message;
}

describe('импорт файла выгрузки', () => {
  it('некорректный JSON', () => {
    expect(fail('{ not json')).toBe('The file is not valid JSON.');
  });

  it('чужой format', () => {
    expect(fail(JSON.stringify({ format: 'something-else', version: 1 }))).toBe(
      'Unknown file format.',
    );
    expect(fail('[1, 2, 3]')).toBe('Unknown file format.');
  });

  it('более новая версия', () => {
    expect(fail(exportText((e) => (e.version = 2)))).toBe(
      'The file was created by a newer version of the editor.',
    );
  });

  it('ошибка схемы — сообщение с путём к полю', () => {
    const msg = fail(
      exportText(
        (e) => ((e.workflow as Record<string, unknown>).graph = { nodes: 'oops', edges: [] }),
      ),
    );
    expect(msg).toMatch(/^The file does not look like a workflow export: .+\.$/);
    expect(msg).toContain('workflow.graph.nodes');
  });

  it('файл до фичи 002 (ноды без имён) отклоняется с путём к полю, список не меняется', () => {
    const msg = fail(
      exportText((e) => {
        for (const n of (e.workflow as { graph: { nodes: Array<Record<string, unknown>> } }).graph
          .nodes)
          delete n.name;
      }),
    );
    expect(msg).toMatch(/^The file does not look like a workflow export: .+\.$/);
    expect(msg).toContain('workflow.graph.nodes.0.name');
  });

  it('выгрузка и загрузка сохраняют имена нодов (SC-007)', () => {
    const r = importExport(exportText(), ctx());
    if (!r.ok) throw new Error(r.message);
    expect(r.workflow.graph.nodes.map((n) => n.name)).toEqual(
      sampleWorkflow().graph.nodes.map((n) => n.name),
    );
  });

  it('неизвестные типы нодов перечислены в сообщении', () => {
    const msg = fail(
      exportText((e) => {
        const g = (e.workflow as { graph: { nodes: Array<{ type: string }> } }).graph;
        g.nodes[0]!.type = 'builtin:teleport';
        g.nodes[1]!.type = 'builtin:magic';
      }),
    );
    expect(msg).toContain('builtin:teleport');
    expect(msg).toContain('builtin:magic');
  });

  it('цикл в графе файла отклоняется', () => {
    const msg = fail(
      exportText((e) => {
        const g = (e.workflow as { graph: { edges: unknown[] } }).graph;
        g.edges.push({
          id: 'e3',
          source: { node: 'n2', port: 'result' },
          target: { node: 'n2', port: 'b' },
        });
      }),
    );
    expect(msg).toMatch(
      /^The graph in the file is invalid: Cannot link: this connection would create a cycle/,
    );
  });

  it('успешный импорт выдаёт workflow с новым id и тем же графом', () => {
    const r = importExport(exportText(), ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workflow.id).toBe('new1');
    expect(r.workflow.graph).toEqual(sampleWorkflow().graph);
    expect(r.workflow.name).toBe('Пример');
    expect(r.composites).toEqual([]);
  });
});
