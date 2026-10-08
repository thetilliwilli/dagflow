// Сервер выполнения для e2e (research R17): настоящий собранный бандл и поддельные серверы
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { test as base } from '@playwright/test';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';
import { createRegistry } from '@dagflow/engine';
import { createEngineHost, PROTOCOL_VERSION, type HostMessage } from '@dagflow/protocol';

const BUNDLE = 'packages/server/dist/dagflow-server.mjs';

/** Свободный порт на 127.0.0.1. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

export interface EngineServer {
  port: number;
  /** Адрес, который пользователь вводит в поле: localhost:<port>. */
  address: string;
  /** Весь вывод сервера (stdout + stderr). */
  output(): string;
  stop(): Promise<void>;
  start(): Promise<void>;
}

/** Запустить собранный сервер (node) на свободном порту и дождаться строки «is listening». */
export async function startEngineServer(): Promise<EngineServer> {
  const port = await freePort();
  let proc: ChildProcess | null = null;
  let out = '';

  async function start() {
    const child = spawn(process.execPath, [BUNDLE, '--port', String(port)], { stdio: 'pipe' });
    proc = child;
    await new Promise<void>((resolve, reject) => {
      const onData = (d: Buffer) => {
        out += d.toString();
        if (out.includes(`is listening on 127.0.0.1:${port}`)) resolve();
      };
      child.stdout!.on('data', onData);
      child.stderr!.on('data', (d: Buffer) => (out += d.toString()));
      child.once('exit', (code) => reject(new Error(`server exited (${code}): ${out}`)));
    });
  }

  async function stop() {
    const child = proc;
    if (!child || child.exitCode !== null) return;
    proc = null;
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.kill('SIGINT');
    });
  }

  await start();
  return { port, address: `localhost:${port}`, output: () => out, stop, start };
}

export interface FakeServer {
  address: string;
  close(): Promise<void>;
}

export type FakeKind =
  | 'not-engine' // обычный HTTP без WebSocket (US1 #8)
  | 'silent' // WebSocket принимает, на hello не отвечает (US1 #8)
  | 'other-protocol' // welcome с protocol: 2, затем version-mismatch и закрытие (US6 #1, #2)
  | 'other-engine' // настоящий хост, но welcome с engine 0.0.9 (US6 #3)
  | 'unknown-node' // настоящий хост без нода «Concatenate» (US6 #4)
  | 'failing' // на open/update — error internal по вкладке (US6 #6)
  | 'forgetful'; // на первый update — unknown-doc, будто вкладка забыта (US6 #7)

/** Хост протокола под видом сервера: строки JSON по WebSocket (как адаптер сервера). */
function serveHost(ws: WsSocket, kind: FakeKind) {
  const host = createEngineHost({
    engineVersion: kind === 'other-engine' ? '0.0.9' : undefined,
    registry:
      kind === 'unknown-node'
        ? (composites) => {
            const full = createRegistry(composites);
            return {
              get: (id) => (id === 'builtin:concat' ? undefined : full.get(id)),
              list: () => full.list().filter((d) => d.id !== 'builtin:concat'),
            };
          }
        : undefined,
  });
  let forgot = false;
  const send = (msgs: HostMessage[]) => msgs.forEach((m) => ws.send(JSON.stringify(m)));
  ws.on('message', (data) => {
    const text = data.toString();
    const msg = JSON.parse(text) as { type: string; doc?: string };
    if (kind === 'other-protocol' && msg.type === 'hello') {
      send([
        { type: 'welcome', protocol: PROTOCOL_VERSION + 1, engine: '0.9.0' },
        { type: 'error', code: 'version-mismatch', detail: String(PROTOCOL_VERSION + 1) },
      ]);
      ws.close();
      return;
    }
    if (kind === 'failing' && (msg.type === 'open' || msg.type === 'update')) {
      send([{ type: 'error', code: 'internal', doc: msg.doc, detail: 'boom' }]);
      return;
    }
    if (kind === 'forgetful' && msg.type === 'update' && !forgot) {
      forgot = true;
      send([{ type: 'error', code: 'unknown-doc', doc: msg.doc }]);
      return;
    }
    send(host.receive(text));
    setTimeout(() => send(host.tick()), 0);
  });
}

/** Поддельный сервер; port — чтобы подменить остановленный настоящий сервер на том же порту. */
export async function startFakeServer(kind: FakeKind, port?: number): Promise<FakeServer> {
  const listenPort = port ?? (await freePort());
  const http: Server = createHttpServer((_req, res) => res.end('hello'));
  let wss: WebSocketServer | null = null;
  if (kind !== 'not-engine') {
    wss = new WebSocketServer({ server: http });
    if (kind !== 'silent') wss.on('connection', (ws) => serveHost(ws, kind));
  }
  await new Promise<void>((resolve) => http.listen(listenPort, '127.0.0.1', resolve));
  return {
    address: `localhost:${listenPort}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const c of wss?.clients ?? []) c.terminate();
        wss?.close();
        http.close(() => resolve());
      }),
  };
}

/** Тест с запущенным сервером выполнения; сервер останавливается после теста. */
export const test = base.extend<{ engineServer: EngineServer }>({
  engineServer: async ({}, use) => {
    const server = await startEngineServer();
    await use(server);
    await server.stop();
  },
});

export { expect } from '@playwright/test';
