import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ClientMessageSchema, HostMessageSchema, NodeStateSchema } from '../src/schemas';
import { byteLength } from '../src/channel';

const graph = {
  nodes: [
    { id: 'a', type: 'builtin:number', name: 'A', position: { x: 0, y: 0 }, values: { value: 2 } },
  ],
  edges: [],
};
const composite = {
  id: 'c1',
  name: 'Sum',
  description: '',
  graph,
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};
const ok = (schema: v.GenericSchema, value: unknown) => v.safeParse(schema, value).success;

describe('схемы сообщений клиента', () => {
  it.each([
    { type: 'hello', protocol: 1, engine: '0.1.0' },
    { type: 'library', composites: [composite] },
    { type: 'open', doc: 'tab-1', rev: 1, graph },
    { type: 'update', doc: 'tab-1', rev: 2, graph },
    { type: 'close', doc: 'tab-1' },
  ])('принимает $type', (msg) => {
    expect(ok(ClientMessageSchema, msg)).toBe(true);
  });

  it.each([
    ['неизвестный type', { type: 'setValue', doc: 'tab-1' }],
    ['rev меньше 1', { type: 'open', doc: 'tab-1', rev: 0, graph }],
    ['дробный rev', { type: 'update', doc: 'tab-1', rev: 1.5, graph }],
    ['граф без nodes', { type: 'open', doc: 'tab-1', rev: 1, graph: { edges: [] } }],
    ['пустой doc', { type: 'close', doc: '' }],
    ['hello без protocol', { type: 'hello', engine: '0.1.0' }],
  ])('отклоняет: %s', (_name, msg) => {
    expect(ok(ClientMessageSchema, msg)).toBe(false);
  });
});

describe('схемы сообщений хоста', () => {
  const state = { status: 'ok', inputs: { a: 1 }, outputs: { result: 3 } };

  it.each([
    { type: 'welcome', protocol: 1, engine: '0.1.0' },
    { type: 'pending', doc: 'tab-1', rev: 1, nodes: ['a'] },
    { type: 'states', doc: 'tab-1', rev: 1, states: { a: state } },
    { type: 'error', code: 'unknown-doc', doc: 'tab-1' },
    { type: 'error', code: 'invalid-message', detail: 'Invalid type' },
  ])('принимает $type', (msg) => {
    expect(ok(HostMessageSchema, msg)).toBe(true);
  });

  it('отклоняет неизвестный код ошибки', () => {
    expect(ok(HostMessageSchema, { type: 'error', code: 'oops' })).toBe(false);
  });

  it('NodeState: неизвестный status не проходит, message необязателен', () => {
    expect(ok(NodeStateSchema, { ...state, status: 'done' })).toBe(false);
    expect(ok(NodeStateSchema, { status: 'error', inputs: {}, outputs: {}, message: 'x' })).toBe(
      true,
    );
    expect(ok(NodeStateSchema, { status: 'computing', inputs: {}, outputs: {} })).toBe(true);
  });
});

describe('byteLength', () => {
  it('считает байты UTF-8', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('Привет')).toBe(12);
    expect(byteLength('→')).toBe(3);
    expect(byteLength('😀')).toBe(4);
  });
});
