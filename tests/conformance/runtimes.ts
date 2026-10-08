// Запуск собранного сервера в Node, Bun и Deno для проверки бандла в каждой среде (research R12, R13)
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const BUNDLE = resolve('packages/server/dist/dagflow-server.mjs');

export interface Runtime {
  name: 'Node' | 'Bun' | 'Deno';
  command: string;
  /** Аргументы перед файлом бандла. */
  prefix: string[];
  minVersion: string;
}

export const RUNTIMES: Runtime[] = [
  { name: 'Node', command: 'node', prefix: [], minVersion: '24' },
  { name: 'Bun', command: 'bun', prefix: [], minVersion: '1.4' },
  { name: 'Deno', command: 'deno', prefix: ['run', '--allow-net'], minVersion: '2.9' },
];

/** Среды нет в PATH — тест падает с понятным текстом, а не пропускается (конституция, R12). */
export function requireRuntime(rt: Runtime) {
  const r = spawnSync(rt.command, ['--version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new Error(
      `${rt.name} is not installed or not in PATH. Install ${rt.name} ${rt.minVersion}+ and run again.`,
    );
  }
}

export function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const srv = createServer();
    srv.once('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => ok(port));
    });
  });
}

export interface RunningServer {
  port: number;
  /** Каталог, из которого запущен бандл: в нём только сам файл (FR-029a, SC-007). */
  dir: string;
  output(): string;
  /** Остановить (Ctrl+C) и дождаться кода выхода. */
  stop(): Promise<number | null>;
  exited: Promise<number | null>;
}

/** Скопировать бандл в пустой временный каталог (без node_modules) и запустить в среде. */
export function launch(
  rt: Runtime,
  args: string[],
): { child: ChildProcess; dir: string; out: () => string; exited: Promise<number | null> } {
  const dir = mkdtempSync(join(tmpdir(), `dagflow-${rt.command}-`));
  copyFileSync(BUNDLE, join(dir, 'dagflow-server.mjs'));
  const child = spawn(rt.command, [...rt.prefix, 'dagflow-server.mjs', ...args], {
    cwd: dir,
    stdio: 'pipe',
    env: { ...process.env, NO_COLOR: '1' },
  });
  let out = '';
  child.stdout!.on('data', (d: Buffer) => (out += d.toString()));
  child.stderr!.on('data', (d: Buffer) => (out += d.toString()));
  const exited = new Promise<number | null>((ok) => child.once('exit', (code) => ok(code)));
  return { child, dir, out: () => out, exited };
}

export async function startServer(
  rt: Runtime,
  extra: string[] = [],
  host = '127.0.0.1',
): Promise<RunningServer> {
  const port = await freePort();
  const { child, dir, out, exited } = launch(rt, ['--port', String(port), ...extra]);
  await new Promise<void>((ok, fail) => {
    const timer = setInterval(() => {
      // Запуск закончен, когда напечатаны обе строки (вторая приходит отдельной записью)
      if (
        out().includes(`is listening on ${host}:${port}`) &&
        out().includes('Press Ctrl+C to stop.')
      ) {
        clearInterval(timer);
        ok();
      }
    }, 20);
    void exited.then((code) => {
      clearInterval(timer);
      fail(new Error(`${rt.name} server exited (${code}): ${out()}`));
    });
  });
  return {
    port,
    dir,
    output: out,
    exited,
    stop: async () => {
      if (child.exitCode === null) child.kill('SIGINT');
      return exited;
    },
  };
}

/** Файлы каталога сервера после работы (SC-007: ничего, кроме бандла). */
export const filesIn = (dir: string) => readdirSync(dir).sort();

/** WebSocket-клиент Node: отправить сообщения и собрать ответы до условия. */
export async function exchange(
  port: number,
  messages: unknown[],
  until: (received: Array<Record<string, unknown>>) => boolean,
  /** Подождать ещё столько после условия: убедиться, что лишних сообщений нет. */
  settleMs = 0,
  timeoutMs = 5_000,
): Promise<Array<Record<string, unknown>>> {
  const ws = new WebSocket(`ws://localhost:${port}/`);
  const received: Array<Record<string, unknown>> = [];
  let done = false;
  return new Promise((ok, fail) => {
    const timer = setTimeout(() => {
      ws.close();
      fail(new Error(`timeout; received: ${JSON.stringify(received).slice(0, 500)}`));
    }, timeoutMs);
    ws.onopen = () => {
      for (const m of messages) ws.send(typeof m === 'string' ? m : JSON.stringify(m));
    };
    ws.onmessage = (e) => {
      received.push(JSON.parse(String(e.data)));
      if (done || !until(received)) return;
      done = true;
      clearTimeout(timer);
      setTimeout(() => {
        ws.close();
        ok(received);
      }, settleMs);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      fail(new Error('WebSocket error'));
    };
  });
}
