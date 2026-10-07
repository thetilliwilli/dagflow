// Точка входа сервера выполнения: одна сборка для Node, Bun и Deno (contracts/server-cli.md)
import { ENGINE_VERSION } from '@dagflow/engine';
import { PROTOCOL_VERSION } from '@dagflow/protocol';
import { serverMessages } from './messages';
import { isLocalHost, parseOptions } from './options';
import { createConnections } from './session';
import type { RuntimeAdapter } from './adapters/runtime';

/** Среда выбирается при запуске; код ws исполняется только в ветке Node (research R10). */
async function loadAdapter(): Promise<RuntimeAdapter> {
  const g = globalThis as { Deno?: unknown; Bun?: unknown };
  if (g.Deno) return (await import('./adapters/deno')).adapter;
  if (g.Bun) return (await import('./adapters/bun')).adapter;
  return (await import('./adapters/node')).adapter;
}

async function main() {
  const runtime = await loadAdapter();
  const parsed = parseOptions(runtime.args());
  if (!parsed.ok) {
    console.error(parsed.message);
    return runtime.exit(parsed.exitCode);
  }
  const { options } = parsed;
  const connections = createConnections({
    log: (line) => console.log(line),
    verbose: options.verbose,
    schedule: (fn) => setTimeout(fn, 0),
  });

  const result = await runtime.listen(options, connections);
  if (!result.ok) {
    console.error(
      result.reason === 'in-use'
        ? serverMessages.portInUse(options.port)
        : serverMessages.cannotListen(options.host),
    );
    return runtime.exit(1);
  }

  console.log(serverMessages.listening(ENGINE_VERSION, options.host, options.port));
  console.log(serverMessages.protocol(PROTOCOL_VERSION));
  if (!isLocalHost(options.host)) console.warn(serverMessages.noAuthentication);
  runtime.onInterrupt(() => runtime.exit(0));
}

void main();
