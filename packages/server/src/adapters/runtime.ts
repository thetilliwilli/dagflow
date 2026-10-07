// Что общий код сервера получает от адаптера среды (Node, Bun, Deno)
import type { ServerOptions } from '../options';
import type { createConnections } from '../session';

export type Connections = ReturnType<typeof createConnections>;

export type ListenResult = { ok: true } | { ok: false; reason: 'in-use' | 'cannot-listen' };

export interface RuntimeAdapter {
  args(): string[];
  exit(code: number): never;
  /** Ctrl+C: остановить сервер с кодом 0 (contracts/server-cli.md). */
  onInterrupt(fn: () => void): void;
  listen(options: ServerOptions, connections: Connections): Promise<ListenResult>;
}

/** Адрес клиента для журнала: IPv4 как есть (без ::ffff:), IPv6 — в скобках. */
export function clientName(address: string | undefined, port: number | undefined): string {
  const host = (address ?? '?').replace(/^::ffff:/, '');
  return `${host.includes(':') ? `[${host}]` : host}:${port ?? '?'}`;
}
