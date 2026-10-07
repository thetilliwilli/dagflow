// Цель «Worker»: канал к хосту в фоновом потоке, падения и перезапуск (FR-027, US2 #2, #3)
import { PROTOCOL_VERSION, type Channel } from '@dagflow/protocol';
import { describe, expect, it } from 'vitest';
import { openWorker, type WorkerLike } from '../../../src/engine-link/channels/worker';
import { createConnection, type OpenResult } from '../../../src/engine-link/connection';
import type { ConnectionStatus } from '../../../src/engine-link/types';

class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  posted: string[] = [];
  terminated = false;
  postMessage(text: string) {
    this.posted.push(text);
  }
  terminate() {
    this.terminated = true;
  }
  reply(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

const welcome = { type: 'welcome', protocol: PROTOCOL_VERSION, engine: '0.1.0' };

function timers() {
  const list = new Map<number, () => void>();
  let seq = 0;
  return {
    set: (fn: () => void) => {
      list.set(++seq, fn);
      return seq;
    },
    clear: (id: unknown) => list.delete(id as number),
    fire: () => {
      const all = [...list.values()];
      list.clear();
      all.forEach((f) => f());
    },
    size: () => list.size,
  };
}

describe('openWorker', () => {
  it('hello → welcome: успех со строками в обе стороны', async () => {
    const w = new FakeWorker();
    const t = timers();
    const opening = openWorker(() => w, { setTimer: t.set, clearTimer: t.clear });
    expect(JSON.parse(w.posted[0]!)).toMatchObject({ type: 'hello' });
    w.reply(welcome);
    const r = await opening.result;
    if (!r.ok || !('welcome' in r)) throw new Error('expected welcome');
    expect(r.engine).toBe('0.1.0');
    const got: string[] = [];
    r.channel.onMessage = (text) => got.push(text);
    r.channel.send('x');
    w.reply({ type: 'pending', doc: 'd', rev: 1, nodes: [] });
    expect(w.posted.at(-1)).toBe('x');
    expect(got).toHaveLength(1);
  });

  it('нет welcome за 3 с → неудача, поток завершён', async () => {
    const w = new FakeWorker();
    const t = timers();
    const opening = openWorker(() => w, { setTimer: t.set, clearTimer: t.clear });
    t.fire();
    expect(await opening.result).toEqual({ ok: false, reason: 'unreachable' });
    expect(w.terminated).toBe(true);
  });

  it('в браузере нет Worker → no-worker', async () => {
    const t = timers();
    const opening = openWorker(
      () => {
        throw new Error('Worker is not defined');
      },
      { setTimer: t.set, clearTimer: t.clear },
    );
    expect(await opening.result).toEqual({ ok: false, reason: 'no-worker' });
  });

  it('событие error у Worker → поток завершён, onClose("crashed")', async () => {
    const w = new FakeWorker();
    const t = timers();
    const opening = openWorker(() => w, { setTimer: t.set, clearTimer: t.clear });
    w.reply(welcome);
    const r = await opening.result;
    if (!r.ok) throw new Error('expected ok');
    let reason = '';
    r.channel.onClose = (why) => (reason = why);
    w.onerror?.();
    expect(w.terminated).toBe(true);
    expect(reason).toBe('crashed');
  });
});

describe('connection: падения фонового потока', () => {
  function setup() {
    let clock = 0;
    const statuses: ConnectionStatus[] = [];
    const restarts: number[] = [];
    const channels: Channel[] = [];
    const conn = createConnection(
      {
        open: () => {
          const ch: Channel = {
            onMessage: () => {},
            onClose: () => {},
            send: () => {},
            close: () => {},
          };
          channels.push(ch);
          const immediate: OpenResult = { ok: true, channel: ch };
          return { immediate, result: Promise.resolve(immediate), cancel: () => {} };
        },
        now: () => clock,
        random: () => 0.5,
        setTimer: () => 0,
        clearTimer: () => {},
      },
      {
        attach: () => {},
        trial: () => {},
        status: (s) => statuses.push(s),
        restarted: () => restarts.push(clock),
      },
    );
    conn.start({ kind: 'worker' });
    return { conn, statuses, restarts, channels, tick: (ms: number) => (clock += ms) };
  }

  it('падение → сразу новый поток и уведомление, без «Offline» (US2 #2)', () => {
    const { statuses, restarts, channels } = setup();
    channels[0]!.onClose('crashed');
    expect(channels).toHaveLength(2);
    expect(restarts).toEqual([0]);
    expect(statuses.filter((s) => s.kind === 'offline')).toEqual([]);
  });

  it('третье падение за минуту → failed, без перезапуска (US2 #3)', () => {
    const { statuses, channels, tick } = setup();
    channels[0]!.onClose('crashed');
    tick(10_000);
    channels[1]!.onClose('crashed');
    tick(10_000);
    channels[2]!.onClose('crashed');
    expect(channels).toHaveLength(3);
    expect(statuses.at(-1)).toEqual({ kind: 'failed' });
  });

  it('падения реже трёх в минуту — перезапуск каждый раз', () => {
    const { statuses, channels, tick } = setup();
    for (let i = 0; i < 4; i++) {
      channels.at(-1)!.onClose('crashed');
      tick(40_000);
    }
    expect(channels).toHaveLength(5);
    expect(statuses.filter((s) => s.kind === 'failed')).toEqual([]);
  });
});
