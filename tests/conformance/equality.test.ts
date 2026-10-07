// SC-001, FR-017, US5 #4: собранный сервер в Node, Bun и Deno даёт те же состояния, что хост в процессе
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NodeState } from '@dagflow/engine';
import { createEngineHost, PROTOCOL_VERSION } from '@dagflow/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exchange, requireRuntime, RUNTIMES, startServer, type RunningServer } from './runtimes';

const DIR = 'tests/conformance/fixtures';
const fixtures = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f, data: JSON.parse(readFileSync(join(DIR, f), 'utf8')) }));

const messages = (data: { workflow: { graph: unknown }; composites: unknown[] }) => [
  { type: 'hello', protocol: PROTOCOL_VERSION, engine: 'conformance' },
  { type: 'library', composites: data.composites },
  { type: 'open', doc: 'doc', rev: 1, graph: data.workflow.graph },
];

/** Эталон: тот же хост протокола в этом процессе; состояния — после JSON, как по сети. */
function expected(data: Parameters<typeof messages>[0]): Record<string, NodeState> {
  const host = createEngineHost();
  const out = messages(data).flatMap((m) => host.receive(JSON.stringify(m)));
  while (host.needsTick()) out.push(...host.tick());
  const states: Record<string, NodeState> = {};
  for (const m of out) if (m.type === 'states') Object.assign(states, m.states);
  return JSON.parse(JSON.stringify(states));
}

describe.each(RUNTIMES)('$name: те же состояния, что хост в процессе', (rt) => {
  let server: RunningServer;
  beforeAll(async () => {
    requireRuntime(rt);
    server = await startServer(rt);
  });
  afterAll(async () => {
    await server?.stop();
  });

  it.each(fixtures)('$name', async ({ data }) => {
    const want = expected(data);
    const none = Object.keys(want).length === 0;
    const received = await exchange(
      server.port,
      messages(data),
      (r) => r.some((m) => m.type === (none ? 'pending' : 'states')),
      none ? 300 : 0,
    );
    const got: Record<string, NodeState> = {};
    for (const m of received) if (m.type === 'states') Object.assign(got, m.states);
    expect(got).toEqual(want);
    expect(received.filter((m) => m.type === 'error')).toEqual([]);
  });
});
