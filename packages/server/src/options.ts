// Параметры запуска сервера (contracts/server-cli.md): чистая функция без process и консоли
import { serverMessages } from './messages';

export interface ServerOptions {
  port: number;
  host: string;
  verbose: boolean;
}

export type ParsedOptions =
  { ok: true; options: ServerOptions } | { ok: false; message: string; exitCode: 2 };

export const DEFAULT_PORT = 8080;
export const DEFAULT_HOST = '127.0.0.1';

export function parseOptions(args: readonly string[]): ParsedOptions {
  const options: ServerOptions = { port: DEFAULT_PORT, host: DEFAULT_HOST, verbose: false };
  const fail = (message: string): ParsedOptions => ({ ok: false, message, exitCode: 2 });
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--verbose') options.verbose = true;
    else if (arg === '--port') {
      const value = args[++i] ?? '';
      const port = Number(value);
      if (!/^\d+$/.test(value) || port < 1 || port > 65535) {
        return fail(serverMessages.invalidPort(value));
      }
      options.port = port;
    } else if (arg === '--host') {
      const value = args[++i];
      if (!value) return fail(serverMessages.unknownOption(arg));
      options.host = value;
    } else return fail(serverMessages.unknownOption(arg));
  }
  return { ok: true, options };
}

/** Адрес этого компьютера: localhost, *.localhost, 127.0.0.0/8, ::1 (spec, Assumptions). */
export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' || h.endsWith('.localhost') || /^127\.\d+\.\d+\.\d+$/.test(h) || h === '::1'
  );
}
