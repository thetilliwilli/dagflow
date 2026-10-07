// US5 #1–#8, FR-029 – FR-031, SC-007: сценарии собранного сервера в каждой среде
import { PROTOCOL_VERSION, MAX_MESSAGE_BYTES } from '@dagflow/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  exchange,
  filesIn,
  launch,
  requireRuntime,
  RUNTIMES,
  startServer,
  type RunningServer,
} from './runtimes';

const hello = { type: 'hello', protocol: PROTOCOL_VERSION, engine: 'conformance' };
const SECRET = 13579.25;
const graph = {
  nodes: [
    {
      id: 'n',
      type: 'builtin:number',
      name: 'TopSecretName',
      position: { x: 0, y: 0 },
      values: { value: SECRET },
    },
  ],
  edges: [],
};
const open = (doc: string) => ({ type: 'open', doc, rev: 1, graph });
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-private-network': 'true',
};

describe.each(RUNTIMES)('$name: сервер выполнения', (rt) => {
  let server: RunningServer;
  beforeAll(async () => {
    requireRuntime(rt);
    server = await startServer(rt);
  });
  afterAll(async () => {
    await server?.stop();
  });

  it('US5 #1, #8: строка запуска из пустого каталога без node_modules', () => {
    expect(server.output()).toContain(
      `DAG Flow engine 0.1.0 is listening on 127.0.0.1:${server.port}\nProtocol version: 1. Press Ctrl+C to stop.`,
    );
    expect(filesIn(server.dir)).toEqual(['dagflow-server.mjs']);
  });

  it('US5 #2: порт занят → текст, код выхода 1, без трассировки', async () => {
    const second = launch(rt, ['--port', String(server.port)]);
    expect(await second.exited).toBe(1);
    expect(second.out().trim()).toBe(
      `Port ${server.port} is already in use. Start the server with another port: --port <number>.`,
    );
  });

  it('неверный порт → текст, код выхода 2', async () => {
    const bad = launch(rt, ['--port', 'abc']);
    expect(await bad.exited).toBe(2);
    expect(bad.out().trim()).toBe('Invalid port “abc”. Use a number from 1 to 65535.');
  });

  it('US5 #5, FR-031: любой Origin и любой путь; CORS на OPTIONS, GET и 101', async () => {
    const options = await fetch(`http://127.0.0.1:${server.port}/any`, { method: 'OPTIONS' });
    expect(options.status).toBe(204);
    for (const [k, v] of Object.entries(CORS)) expect(options.headers.get(k)).toBe(v);
    const get = await fetch(`http://127.0.0.1:${server.port}/`);
    expect(get.status).toBe(200);
    expect(await get.text()).toBe('DAG Flow engine 0.1.0');
    expect(get.headers.get('access-control-allow-origin')).toBe('*');

    const upgradeHeaders = await new Promise<Record<string, unknown>>((ok, fail) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/deep/path`, {
        origin: 'https://evil.example',
      });
      ws.on('upgrade', (res) => {
        ok(res.headers);
        ws.close();
      });
      ws.on('error', fail);
    });
    for (const [k, v] of Object.entries(CORS)) expect(upgradeHeaders[k]).toBe(v);
  });

  it('US5 #6, FR-018: два подключения изолированы', async () => {
    await exchange(server.port, [hello, open('tab-1')], (r) => r.some((m) => m.type === 'states'));
    const other = await exchange(server.port, [hello, { type: 'close', doc: 'tab-1' }], (r) =>
      r.some((m) => m.type === 'error'),
    );
    expect(other.at(-1)).toEqual({ type: 'error', code: 'unknown-doc', doc: 'tab-1' });
  });

  it('лимит: 8 МБ < сообщение ≤ лимита транспорта → too-large, соединение живо; больше — закрыто', async () => {
    const big = JSON.stringify({ type: 'close', doc: 'x'.repeat(MAX_MESSAGE_BYTES) });
    const r = await exchange(server.port, [hello, big, { type: 'close', doc: 'after' }], (m) =>
      m.some((x) => x.doc === 'after'),
    );
    expect(r.map((m) => m.code ?? m.type)).toEqual(['welcome', 'too-large', 'unknown-doc']);

    const closed = await new Promise<boolean>((ok) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/`);
      ws.on('open', () => ws.send('x'.repeat(MAX_MESSAGE_BYTES + 64 * 1024)));
      ws.on('close', () => ok(true));
      ws.on('error', () => {});
      setTimeout(() => ok(false), 5_000);
    });
    expect(closed).toBe(true);
  });

  it('некорректное сообщение → invalid-message, соединение живо', async () => {
    const r = await exchange(server.port, [hello, '{bad', { type: 'close', doc: 'after' }], (m) =>
      m.some((x) => x.doc === 'after'),
    );
    expect(r.map((m) => m.code ?? m.type)).toEqual(['welcome', 'invalid-message', 'unknown-doc']);
  });

  it('US5 #7, FR-030a: журнал подключений и ошибок без данных workflow', async () => {
    await exchange(server.port, [hello, open('tab-9'), '{bad'], (r) =>
      r.some((m) => m.type === 'error'),
    );
    await new Promise((ok) => setTimeout(ok, 200));
    const out = server.output();
    expect(out).toMatch(/Connected: \S+:\d+ \(connections: 1\)/);
    expect(out).toMatch(/Error from \S+:\d+: invalid-message/);
    expect(out).toMatch(/Disconnected: \S+:\d+ \(connections: 0\)/);
    expect(out).not.toContain(String(SECRET));
    expect(out).not.toContain('TopSecretName');
  });

  it('SC-007: после работы в каталоге сервера нет файлов, кроме бандла', () => {
    expect(filesIn(server.dir)).toEqual(['dagflow-server.mjs']);
  });
});

describe.each(RUNTIMES)('$name: параметры запуска', (rt) => {
  beforeAll(() => requireRuntime(rt));

  it('US5 #3, FR-030: адрес для сети → предупреждение об отсутствии аутентификации', async () => {
    const s = await startServer(rt, ['--host', '0.0.0.0'], '0.0.0.0');
    try {
      expect(s.output()).toContain(
        'The engine has no authentication. Anyone who can reach this address can run workflows on it.',
      );
    } finally {
      await s.stop();
    }
  });

  it('--verbose: строка на каждое сообщение в обе стороны, без данных workflow (FR-030a)', async () => {
    const s = await startServer(rt, ['--verbose']);
    try {
      await exchange(s.port, [hello, open('tab-v')], (r) => r.some((m) => m.type === 'states'));
      await new Promise((ok) => setTimeout(ok, 200));
      const lines = s
        .output()
        .split('\n')
        .filter((l) => / (in|out) /.test(l))
        .map((l) => l.replace(/^\S+ /, '').replace(/ \d+ B$/, ''));
      expect(lines).toEqual([
        'in hello -',
        'out welcome -',
        'in open tab-v',
        'out pending tab-v',
        'out states tab-v',
      ]);
      expect(s.output()).not.toContain(String(SECRET));
    } finally {
      await s.stop();
    }
  });

  it('Ctrl+C → код выхода 0', async () => {
    const s = await startServer(rt);
    expect(await s.stop()).toBe(0);
  });
});
