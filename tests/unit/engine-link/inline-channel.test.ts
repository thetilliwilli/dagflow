import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '@dagflow/protocol';
import { createInlineChannel } from '../../../src/engine-link/channels/inline';

function setup() {
  const queue: Array<() => void> = [];
  const channel = createInlineChannel((fn) => queue.push(fn));
  const received: Array<{ type: string; [k: string]: unknown }> = [];
  channel.onMessage = (text) => received.push(JSON.parse(text));
  const send = (msg: unknown) => channel.send(JSON.stringify(msg));
  const frame = () => {
    while (queue.length > 0) queue.shift()!();
  };
  return { channel, queue, received, send, frame };
}

const graph = {
  nodes: [
    { id: 'n', type: 'builtin:number', name: 'N', position: { x: 0, y: 0 }, values: { value: 7 } },
  ],
  edges: [],
};

describe('канал Local', () => {
  it('ответы приходят строками сразу, пересчёт — в запланированном кадре', () => {
    const { queue, received, send, frame } = setup();
    send({ type: 'hello', protocol: PROTOCOL_VERSION, engine: 'x' });
    expect(received.map((m) => m.type)).toEqual(['welcome']);
    send({ type: 'open', doc: 't', rev: 1, graph });
    expect(received.map((m) => m.type)).toEqual(['welcome', 'pending']);
    expect(queue).toHaveLength(1);
    frame();
    expect(received.at(-1)).toMatchObject({ type: 'states', doc: 't', rev: 1 });
  });

  it('несколько правок до кадра — один запланированный пересчёт', () => {
    const { queue, received, send, frame } = setup();
    send({ type: 'hello', protocol: PROTOCOL_VERSION, engine: 'x' });
    send({ type: 'open', doc: 't', rev: 1, graph });
    send({
      type: 'update',
      doc: 't',
      rev: 2,
      graph: { ...graph, nodes: [{ ...graph.nodes[0], values: { value: 8 } }] },
    });
    expect(queue).toHaveLength(1);
    frame();
    expect(received.filter((m) => m.type === 'states')).toHaveLength(1);
  });

  it('другая версия протокола → ответы и закрытие канала', () => {
    const { channel, received, send } = setup();
    let closed = '';
    channel.onClose = (reason) => (closed = reason);
    send({ type: 'hello', protocol: PROTOCOL_VERSION + 1, engine: 'x' });
    expect(received.map((m) => m.type)).toEqual(['welcome', 'error']);
    expect(closed).toBe('closed');
  });

  it('после close сообщения не доставляются и пересчёт не идёт', () => {
    const { channel, received, send, frame } = setup();
    send({ type: 'hello', protocol: PROTOCOL_VERSION, engine: 'x' });
    send({ type: 'open', doc: 't', rev: 1, graph });
    channel.close();
    frame();
    expect(received.map((m) => m.type)).toEqual(['welcome', 'pending']);
  });
});
