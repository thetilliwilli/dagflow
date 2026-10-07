// Пробная смена цели (FR-007): текущая цель работает, пока новая не подтвердит; новая попытка отменяет прежнюю
import type { Channel } from '@dagflow/protocol';
import { describe, expect, it } from 'vitest';
import {
  createConnection,
  type ConnectionEvents,
  type OpenResult,
} from '../../../src/engine-link/connection';
import type { EngineTarget, Trial } from '../../../src/engine-link/types';

function fakeChannel(name: string): Channel & { name: string; closed: boolean } {
  const c = {
    name,
    closed: false,
    onMessage: () => {},
    onClose: () => {},
    send: () => {},
    close: () => {
      c.closed = true;
    },
  };
  return c;
}

function setup() {
  const openings: Array<{
    target: EngineTarget;
    resolve: (r: OpenResult) => void;
    cancelled: boolean;
  }> = [];
  const log: string[] = [];
  const trials: Array<Trial | undefined> = [];
  const events: ConnectionEvents = {
    attach: (channel, welcome, info) =>
      log.push(
        `attach ${(channel as { name?: string }).name} ${welcome ?? '-'} ${info.target.kind} ${info.encrypted}`,
      ),
    trial: (t) => trials.push(t),
    unavailable: (target, r) => log.push(`unavailable ${target.kind} ${r.reason}`),
  };
  const conn = createConnection(
    {
      open: (target) => {
        let resolve!: (r: OpenResult) => void;
        const result = new Promise<OpenResult>((r) => (resolve = r));
        const entry = { target, resolve, cancelled: false };
        openings.push(entry);
        return {
          result,
          cancel: () => {
            entry.cancelled = true;
            resolve({ ok: false, reason: 'cancelled' });
          },
        };
      },
    },
    events,
  );
  return { conn, openings, log, trials };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const server = (address: string): EngineTarget => ({ kind: 'server', address });

describe('connection: пробная смена цели', () => {
  it('успех: новый канал подключён, старый закрыт, пробная попытка снята', async () => {
    const { conn, openings, log, trials } = setup();
    const local = fakeChannel('local');
    conn.start({ kind: 'local' });
    openings[0]!.resolve({ ok: true, channel: local });
    await flush();
    conn.select(server('localhost:8080'));
    expect(trials.at(-1)).toEqual({ target: server('localhost:8080'), phase: 'probing' });
    expect(local.closed).toBe(false);
    openings[1]!.resolve({
      ok: true,
      channel: fakeChannel('ws'),
      scheme: 'ws',
      engine: '0.1.0',
      encrypted: false,
      welcome: 'W',
    });
    await flush();
    expect(local.closed).toBe(true);
    expect(log).toEqual(['attach local - local false', 'attach ws W server false']);
    expect(trials.at(-1)).toBeUndefined();
  });

  it('неудача: прежний канал остаётся, причина в пробной попытке', async () => {
    const { conn, openings, log, trials } = setup();
    const local = fakeChannel('local');
    conn.start({ kind: 'local' });
    openings[0]!.resolve({ ok: true, channel: local });
    await flush();
    conn.select(server('localhost:8081'));
    openings[1]!.resolve({ ok: false, reason: 'unreachable' });
    await flush();
    expect(local.closed).toBe(false);
    expect(log).toHaveLength(1);
    expect(trials.at(-1)).toEqual({
      target: server('localhost:8081'),
      phase: 'probing',
      failure: 'unreachable',
    });
  });

  it('другая версия протокола → failure incompatible с версиями хоста', async () => {
    const { conn, openings, trials } = setup();
    conn.select(server('localhost:8080'));
    openings[0]!.resolve({
      ok: false,
      reason: 'incompatible',
      host: { protocol: 2, engine: '0.9' },
    });
    await flush();
    expect(trials.at(-1)).toMatchObject({ failure: 'incompatible', host: { protocol: 2 } });
  });

  it('новая попытка отменяет незавершённую; результат старой не применяется', async () => {
    const { conn, openings, log } = setup();
    conn.select(server('a:1'));
    conn.select(server('b:2'));
    expect(openings[0]!.cancelled).toBe(true);
    openings[1]!.resolve({ ok: true, channel: fakeChannel('b') });
    await flush();
    expect(log).toEqual(['attach b - server false']);
  });

  it('start: неудача → unavailable (сохранённая цель недоступна)', async () => {
    const { conn, openings, log } = setup();
    conn.start(server('localhost:8080'));
    openings[0]!.resolve({ ok: false, reason: 'unreachable' });
    await flush();
    expect(log).toEqual(['unavailable server unreachable']);
  });

  it('dispose отменяет попытку и закрывает текущий канал', async () => {
    const { conn, openings } = setup();
    const local = fakeChannel('local');
    conn.start({ kind: 'local' });
    openings[0]!.resolve({ ok: true, channel: local });
    await flush();
    conn.select(server('x:1'));
    conn.dispose();
    expect(openings[1]!.cancelled).toBe(true);
    expect(local.closed).toBe(true);
  });
});
