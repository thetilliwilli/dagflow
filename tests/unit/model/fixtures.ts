import type { Workflow } from '../../../src/engine';

export function sampleWorkflow(id = 'wf1'): Workflow {
  return {
    id,
    name: 'Пример',
    createdAt: '2026-10-05T12:00:00.000Z',
    updatedAt: '2026-10-05T12:05:00.000Z',
    graph: {
      nodes: [
        { id: 'n1', type: 'builtin:number', name: 'Number', position: { x: 0, y: 0 }, values: { value: 2 } },
        { id: 'n2', type: 'builtin:add', name: 'Итого 2 + 3', position: { x: 200, y: 0 }, values: { b: 3 } },
        { id: 'n3', type: 'builtin:show', name: 'Show', position: { x: 400, y: 0 }, values: {} },
        { id: 'n4', type: 'builtin:json', name: 'JSON value', position: { x: 0, y: 200 }, values: { value: { a: [1, null, 'x'] } } },
      ],
      edges: [
        { id: 'e1', source: { node: 'n1', port: 'value' }, target: { node: 'n2', port: 'a' } },
        { id: 'e2', source: { node: 'n2', port: 'result' }, target: { node: 'n3', port: 'value' } },
      ],
    },
  };
}
