import { describe, expect, it } from 'vitest';
import type { CompositeDef, Workflow } from '@dagflow/engine';
import { importExport, mergeComposites } from '../../../src/model/import';
import { buildExport, toJsonText } from '../../../src/model/serialize';
import { def, doubleSum } from '../../../packages/engine/test/composite-fixtures';
import { graph, node } from '../../../packages/engine/test/helpers';

function seqId() {
  let n = 0;
  return () => `new${++n}`;
}

function workflowUsing(type: string): Workflow {
  return {
    id: 'w',
    name: 'W',
    createdAt: '',
    updatedAt: '',
    graph: graph([{ ...node('I', type), values: { a: 1, b: 1 } }]),
  };
}

describe('слияние определений (FR-029a)', () => {
  it('определение с тем же содержимым переиспользуется', () => {
    const existing = { OLD: doubleSum(2, 'OLD') };
    const r = mergeComposites([doubleSum(2, 'DS')], existing, seqId());
    expect(r.added).toEqual([]);
    expect(r.idMap.get('DS')).toBe('OLD');
    expect(r.notices).toEqual([]);
  });

  it('то же имя, другое содержимое → «(2)», при занятом «(2)» → «(3)»; уведомление на каждый конфликт', () => {
    const existing: Record<string, CompositeDef> = {
      OLD: doubleSum(2, 'OLD'),
      OLD2: { ...doubleSum(5, 'OLD2'), name: 'Удвоенная сумма (2)' },
    };
    const snapshot = JSON.stringify(existing);
    const r = mergeComposites([doubleSum(3, 'DS')], existing, seqId());
    expect(r.added).toHaveLength(1);
    expect(r.added[0]!.name).toBe('Удвоенная сумма (3)');
    expect(r.added[0]!.id).not.toBe('OLD');
    expect(r.notices).toHaveLength(1);
    expect(r.notices[0]).toContain('Удвоенная сумма (3)');
    expect(JSON.stringify(existing)).toBe(snapshot); // существующие не изменяются
  });

  it('занятый id при уникальном имени → новый id', () => {
    const existing = { DS: { ...doubleSum(9, 'DS'), name: 'Другое' } };
    const r = mergeComposites([doubleSum(2, 'DS')], existing, seqId());
    expect(r.added[0]!.id).toBe('new1');
    expect(r.idMap.get('DS')).toBe('new1');
  });

  it('ссылки во вложенных определениях переписаны', () => {
    const inner = doubleSum(3, 'DS');
    const outer = def('OUT', 'Внешний', graph([node('ds', 'composite:DS')]));
    const existing = { DS: { ...doubleSum(9, 'DS'), name: 'Удвоенная сумма' } };
    const r = mergeComposites([outer, inner], existing, seqId());
    const newInner = r.added.find((d) => d.name === 'Удвоенная сумма (2)')!;
    const newOuter = r.added.find((d) => d.name === 'Внешний')!;
    expect(newOuter.graph.nodes[0]!.type).toBe(`composite:${newInner.id}`);
  });
});

describe('импорт и выгрузка с составными нодами', () => {
  it('ссылки в workflow переписаны, уведомления возвращены', () => {
    const file = toJsonText(buildExport(workflowUsing('composite:DS'), [doubleSum(3, 'DS')], 't'));
    let n = 0;
    const r = importExport(file, {
      workflows: {},
      composites: { DS: doubleSum(2, 'DS') },
      newId: () => `id${++n}`,
      now: () => 't',
    });
    if (!r.ok) throw new Error(r.message);
    expect(r.composites).toHaveLength(1);
    expect(r.workflow.graph.nodes[0]!.type).toBe(`composite:${r.composites[0]!.id}`);
    expect(r.notices).toHaveLength(1);
  });

  it('buildExport включает транзитивно используемые определения (FR-029)', () => {
    const c = def('C', 'C', graph([node('n', 'builtin:number')]));
    const b = def('B', 'B', graph([node('c', 'composite:C')]));
    const unused = def('U', 'U', graph([]));
    const exp = buildExport(workflowUsing('composite:B'), [b, c, unused], 't');
    expect(exp.composites.map((d) => d.id).sort()).toEqual(['B', 'C']);
  });
});

describe('рекурсия определений в файле (FR-026)', () => {
  it('файл с составным нодом внутри самого себя (прямо или косвенно) отклоняется', () => {
    const a = def('A', 'A', graph([node('b', 'composite:B')]));
    const b = def('B', 'B', graph([node('a', 'composite:A')]));
    const file = toJsonText(buildExport(workflowUsing('composite:A'), [a, b], 't'));
    const r = importExport(file, { workflows: {}, composites: {}, newId: seqId(), now: () => 't' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(
        /^Composite node “[AB]” in the file contains itself; a composite node cannot be inside itself \(directly or through others\)\.$/,
      );
    }
  });
});
