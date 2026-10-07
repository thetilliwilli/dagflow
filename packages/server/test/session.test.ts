// Соединение ↔ хост протокола: журнал, лимит, тики (FR-018, FR-030a)
import { ENGINE_VERSION } from '@dagflow/engine';
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from '@dagflow/protocol';
import { describe, expect, it } from 'vitest';
import { createConnections, TRANSPORT_LIMIT } from '../src/session';

function setup(verbose = false) {
  const log: string[] = [];
  const timers: Array<() => void> = [];
  const conns = createConnections({
    log: (line) => log.push(line),
    verbose,
    schedule: (fn) => timers.push(fn),
  });
  function socket() {
    const sent: Array<Record<string, unknown>> = [];
    const s = {
      sent,
      closedWith: undefined as number | undefined,
      send: (text: string) => sent.push(JSON.parse(text)),
      close: (code?: number) => {
        s.closedWith = code ?? 1000;
      },
    };
    return s;
  }
  const runTimers = () => {
    while (timers.length > 0) timers.shift()!();
  };
  return { conns, log, socket, runTimers, timers };
}

const hello = JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, engine: 'x' });
const SECRET = 4242.5;
const open = (doc: string, rev = 1) =>
  JSON.stringify({
    type: 'open',
    doc,
    rev,
    graph: {
      nodes: [
        {
          id: 'n',
          type: 'builtin:number',
          name: 'Secret',
          position: { x: 0, y: 0 },
          values: { value: SECRET },
        },
      ],
      edges: [],
    },
  });

describe('соединения сервера', () => {
  it('строки журнала: подключение, ошибка обмена, отключение — со счётчиком', () => {
    const { conns, log, socket } = setup();
    const a = conns.open(socket(), '127.0.0.1:50001');
    const b = conns.open(socket(), '127.0.0.1:50002');
    a.receive('{bad');
    a.close();
    b.close();
    expect(log).toEqual([
      'Connected: 127.0.0.1:50001 (connections: 1)',
      'Connected: 127.0.0.1:50002 (connections: 2)',
      'Error from 127.0.0.1:50001: invalid-message',
      'Disconnected: 127.0.0.1:50001 (connections: 1)',
      'Disconnected: 127.0.0.1:50002 (connections: 0)',
    ]);
  });

  it('повторное закрытие считается один раз (двойной close в Deno)', () => {
    const { conns, log, socket } = setup();
    const a = conns.open(socket(), 'c');
    a.close();
    a.close();
    expect(log.filter((l) => l.startsWith('Disconnected'))).toHaveLength(1);
    expect(conns.count()).toBe(0);
  });

  it('ответы хоста уходят строками; пересчёт — по таймеру', () => {
    const { conns, socket, runTimers, timers } = setup();
    const s = socket();
    const a = conns.open(s, 'c');
    a.receive(hello);
    a.receive(open('t1'));
    expect(s.sent.map((m) => m.type)).toEqual(['welcome', 'pending']);
    expect(timers).toHaveLength(1);
    runTimers();
    expect(s.sent.at(-1)).toMatchObject({ type: 'states', doc: 't1' });
  });

  it('другая версия протокола → welcome, error и закрытие сокета', () => {
    const { conns, socket } = setup();
    const s = socket();
    conns.open(s, 'c').receive(JSON.stringify({ type: 'hello', protocol: 99, engine: 'x' }));
    expect(s.sent).toEqual([
      { type: 'welcome', protocol: PROTOCOL_VERSION, engine: ENGINE_VERSION },
      { type: 'error', code: 'version-mismatch', detail: String(PROTOCOL_VERSION) },
    ]);
    expect(s.closedWith).toBe(1000);
  });

  it('больше 8 МБ (до лимита транспорта) → too-large, соединение живо', () => {
    const { conns, socket } = setup();
    const s = socket();
    const a = conns.open(s, 'c');
    a.receive(hello);
    a.receive('x'.repeat(MAX_MESSAGE_BYTES + 10));
    expect(s.sent.at(-1)).toEqual({ type: 'error', code: 'too-large' });
    expect(s.closedWith).toBeUndefined();
  });

  it('больше лимита транспорта → закрытие с 1009 (Deno: лимит делает адаптер)', () => {
    const { conns, socket } = setup();
    const s = socket();
    conns.open(s, 'c').receive('x'.repeat(TRANSPORT_LIMIT + 1));
    expect(s.closedWith).toBe(1009);
  });

  it('закрытие сокета отпускает хост; новое соединение начинает с чистого хоста (FR-018)', () => {
    const { conns, socket } = setup();
    const a = conns.open(socket(), 'a');
    a.receive(hello);
    a.receive(open('t1'));
    a.close();
    const s = socket();
    const b = conns.open(s, 'b');
    b.receive(hello);
    b.receive(JSON.stringify({ type: 'close', doc: 't1' }));
    expect(s.sent.at(-1)).toEqual({ type: 'error', code: 'unknown-doc', doc: 't1' });
  });

  it('после закрытия сообщения не обрабатываются и таймер не шлёт', () => {
    const { conns, socket, runTimers } = setup();
    const s = socket();
    const a = conns.open(s, 'c');
    a.receive(hello);
    a.receive(open('t1'));
    a.close();
    runTimers();
    a.receive(hello);
    expect(s.sent.map((m) => m.type)).toEqual(['welcome', 'pending']);
  });

  it('--verbose: строка на каждое сообщение в обе стороны; значений графа в журнале нет', () => {
    const { conns, log, socket, runTimers } = setup(true);
    const a = conns.open(socket(), 'c');
    a.receive(hello);
    a.receive(open('t1'));
    runTimers();
    const lines = log.filter((l) => / (in|out) /.test(l));
    expect(lines.map((l) => l.replace(/ \d+ B$/, ''))).toEqual([
      'c in hello -',
      'c out welcome -',
      'c in open t1',
      'c out pending t1',
      'c out states t1',
    ]);
    expect(lines.every((l) => / \d+ B$/.test(l))).toBe(true);
    expect(log.join('\n')).not.toContain(String(SECRET));
    expect(log.join('\n')).not.toContain('Secret');
  });

  it('без --verbose сообщения не печатаются', () => {
    const { conns, log, socket } = setup();
    const a = conns.open(socket(), 'c');
    a.receive(hello);
    expect(log).toEqual(['Connected: c (connections: 1)']);
  });
});
