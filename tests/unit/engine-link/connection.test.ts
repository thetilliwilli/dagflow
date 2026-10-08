// Подключение к цели: пробная смена (FR-007) и переподключение (FR-020 – FR-022a, data-model)
import type { Channel } from '@dagflow/protocol';
import { describe, expect, it } from 'vitest';
import {
  createConnection,
  type ConnectionEvents,
  type OpenResult,
} from '../../../src/engine-link/connection';
import type { ConnectionStatus, EngineTarget, Trial } from '../../../src/engine-link/types';

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

function setup(random = 0.5) {
  let clock = 1_000;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let timerSeq = 0;
  const statuses: ConnectionStatus[] = [];
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
    status: (st) => statuses.push(st),
    restarted: () => log.push('restarted'),
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
      now: () => clock,
      random: () => random,
      setTimer: (fn, ms) => {
        timers.set(++timerSeq, { fn, at: clock + ms });
        return timerSeq;
      },
      clearTimer: (id) => {
        timers.delete(id as number);
      },
    },
    events,
  );
  /** Перевести часы вперёд и выполнить созревшие таймеры. */
  const advance = (ms: number) => {
    clock += ms;
    for (const [id, t] of [...timers]) {
      if (t.at <= clock) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  return { conn, openings, log, trials, statuses, timers, advance, now: () => clock };
}

const welcomeOk = (name: string) => ({
  ok: true as const,
  channel: fakeChannel(name),
  scheme: 'ws' as const,
  engine: '0.1.0',
  encrypted: false,
  welcome: 'W',
});

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

  it('start: сохранённая цель недоступна → offline и повторы (FR-022, US3 #7)', async () => {
    const { conn, openings, statuses } = setup();
    conn.start(server('localhost:8080'));
    openings[0]!.resolve({ ok: false, reason: 'unreachable' });
    await flush();
    expect(statuses.at(-1)).toEqual({ kind: 'offline', attempt: 1, retryAt: 1_500 });
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

describe('connection: обрыв и переподключение (US3)', () => {
  /** Подключиться к серверу и вернуть его канал. */
  async function connected(random = 0.5) {
    const ctx = setup(random);
    ctx.conn.start(server('localhost:8080'));
    const ch = welcomeOk('s1');
    ctx.openings[0]!.resolve(ch);
    await flush();
    return { ...ctx, channel: ch.channel };
  }

  it('обрыв → offline с первой паузой 0,5 с; по таймеру — connecting и новая проба', async () => {
    const { channel, statuses, openings, advance } = await connected();
    channel.onClose('closed');
    expect(statuses.at(-1)).toEqual({ kind: 'offline', attempt: 1, retryAt: 1_500 });
    advance(499);
    expect(openings).toHaveLength(1);
    advance(1);
    expect(statuses.at(-1)).toEqual({ kind: 'connecting' });
    expect(openings).toHaveLength(2);
    expect(openings[1]!.target).toEqual(server('localhost:8080'));
  });

  it('пауза растёт 0,5 → 1 → 2 → 4 → 8 → 10 с и не превышает 10 с (FR-020)', async () => {
    const { channel, statuses, openings, advance, now } = await connected();
    channel.onClose('closed');
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      const st = statuses.at(-1) as Extract<ConnectionStatus, { kind: 'offline' }>;
      delays.push(st.retryAt - now());
      advance(st.retryAt - now());
      openings.at(-1)!.resolve({ ok: false, reason: 'unreachable' });
      await flush();
    }
    expect(delays).toEqual([500, 1_000, 2_000, 4_000, 8_000, 10_000, 10_000]);
  });

  it.each([0, 0.999])('разброс ±20 %% не выводит паузу за 10 с (random = %s)', async (random) => {
    const { channel, statuses, openings, advance, now } = await connected(random);
    channel.onClose('closed');
    for (let i = 0; i < 8; i++) {
      const st = statuses.at(-1) as Extract<ConnectionStatus, { kind: 'offline' }>;
      expect(st.retryAt - now()).toBeLessThanOrEqual(10_000);
      advance(st.retryAt - now());
      openings.at(-1)!.resolve({ ok: false, reason: 'unreachable' });
      await flush();
    }
  });

  it('успешная попытка → полный снимок через attach; следующий обрыв снова с 0,5 с', async () => {
    const { channel, statuses, openings, advance, log, now } = await connected();
    channel.onClose('closed');
    advance(500);
    openings[1]!.resolve({ ok: false, reason: 'unreachable' });
    await flush();
    advance(1_000);
    const second = welcomeOk('s2');
    openings[2]!.resolve(second);
    await flush();
    expect(log.at(-1)).toBe('attach s2 W server false');
    second.channel.onClose('closed');
    expect(statuses.at(-1)).toEqual({ kind: 'offline', attempt: 1, retryAt: now() + 500 });
  });

  it('«Retry now» → попытка сразу, таймер снят (US3 #4)', async () => {
    const { conn, channel, openings, timers, statuses } = await connected();
    channel.onClose('closed');
    conn.retryNow();
    expect(timers.size).toBe(0);
    expect(openings).toHaveLength(2);
    expect(statuses.at(-1)).toEqual({ kind: 'connecting' });
  });

  it('«Retry now» во время идущей попытки ничего не делает', async () => {
    const { conn, channel, openings } = await connected();
    channel.onClose('closed');
    conn.retryNow();
    conn.retryNow();
    expect(openings).toHaveLength(2);
  });

  it('другой протокол при переподключении → incompatible, повторов нет (US6 #2)', async () => {
    const { channel, statuses, openings, advance, timers } = await connected();
    channel.onClose('closed');
    advance(500);
    openings[1]!.resolve({
      ok: false,
      reason: 'incompatible',
      host: { protocol: 2, engine: '0.9' },
    });
    await flush();
    expect(statuses.at(-1)).toEqual({ kind: 'incompatible', host: { protocol: 2, engine: '0.9' } });
    expect(timers.size).toBe(0);
  });

  it('halt (клиент увидел другой протокол) → закрытие канала не ведёт к повторам', async () => {
    const { conn, channel, statuses, timers } = await connected();
    conn.halt();
    channel.onClose('closed');
    expect(statuses.filter((s) => s.kind === 'offline')).toEqual([]);
    expect(timers.size).toBe(0);
  });

  it('смена цели во время offline: пока проба идёт, повторы к старой продолжаются; успех их прекращает', async () => {
    const { conn, channel, openings, timers, advance, log } = await connected();
    channel.onClose('closed');
    conn.select({ kind: 'local' });
    expect(timers.size).toBe(1);
    advance(500);
    expect(openings.map((o) => o.target.kind)).toEqual(['server', 'local', 'server']);
    openings[1]!.resolve({ ok: true, channel: fakeChannel('local') });
    await flush();
    expect(openings[2]!.cancelled).toBe(true);
    expect(timers.size).toBe(0);
    expect(log.at(-1)).toBe('attach local - local false');
  });

  it('useLocal из offline: Local сразу, повторы прекращены (FR-022a)', async () => {
    const { conn, channel, timers, log, trials, openings } = await connected();
    channel.onClose('closed');
    conn.useLocal();
    openings.at(-1)!.resolve({ ok: true, channel: fakeChannel('local') });
    await flush();
    expect(timers.size).toBe(0);
    expect(log.at(-1)).toMatch(/^attach .* local false$/);
    expect(trials.at(-1)).toBeUndefined();
  });

  it.each([
    [
      'incompatible',
      { ok: false as const, reason: 'incompatible' as const, host: { protocol: 2, engine: '0.9' } },
    ],
  ])('useLocal из %s: Local сразу (FR-022a)', async (_name, failure) => {
    const { conn, channel, openings, log, advance, statuses } = await connected();
    channel.onClose('closed');
    advance(500);
    openings[1]!.resolve(failure);
    await flush();
    expect(statuses.at(-1)?.kind).toBe('incompatible');
    conn.useLocal();
    openings.at(-1)!.resolve({ ok: true, channel: fakeChannel('local') });
    await flush();
    expect(log.at(-1)).toBe('attach local - local false');
  });

  it('useLocal из failed (фоновый поток): Local сразу (FR-022a)', async () => {
    const { conn, openings, log, statuses } = setup();
    conn.start({ kind: 'worker' });
    // Три падения подряд (часы стоят — все в пределах минуты): третье → failed
    for (let i = 0; i < 3; i++) {
      const w = fakeChannel(`w${i}`);
      openings.at(-1)!.resolve({ ok: true, channel: w });
      await flush();
      w.onClose('crashed');
    }
    expect(statuses.at(-1)).toEqual({ kind: 'failed' });
    conn.useLocal();
    openings.at(-1)!.resolve({ ok: true, channel: fakeChannel('local') });
    await flush();
    expect(log.at(-1)).toBe('attach local - local false');
  });

  it('lna-denied при старте или повторе → failed с причиной, повторов нет (FR-011)', async () => {
    const { conn, openings, statuses, timers } = setup();
    conn.start(server('localhost:8080'));
    openings[0]!.resolve({ ok: false, reason: 'lna-denied' });
    await flush();
    expect(statuses.at(-1)).toEqual({ kind: 'failed', reason: 'lna-denied' });
    expect(timers.size).toBe(0);
  });

  it('cancelTrial отменяет идущую пробную попытку (FR-007)', async () => {
    const { conn, openings, log } = setup();
    conn.select(server('a:1'));
    conn.cancelTrial();
    expect(openings[0]!.cancelled).toBe(true);
    await flush();
    expect(log).toEqual([]);
  });
});
