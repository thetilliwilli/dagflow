// Сервер выполнения для e2e (research R17): настоящий собранный бандл и поддельные серверы
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { test as base } from '@playwright/test';
import { WebSocketServer } from 'ws';

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

/**
 * Поддельные серверы (US1 #8):
 * - `not-engine` — обычный HTTP без WebSocket;
 * - `silent` — WebSocket принимает, но на hello не отвечает.
 */
export async function startFakeServer(kind: 'not-engine' | 'silent'): Promise<FakeServer> {
  const port = await freePort();
  const http: Server = createHttpServer((_req, res) => res.end('hello'));
  let wss: WebSocketServer | null = null;
  if (kind === 'silent') wss = new WebSocketServer({ server: http });
  await new Promise<void>((resolve) => http.listen(port, '127.0.0.1', resolve));
  return {
    address: `localhost:${port}`,
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
