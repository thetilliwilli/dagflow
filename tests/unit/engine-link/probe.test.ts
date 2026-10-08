// Перебор схем ws/wss, таймауты, «не engine», запрет браузера (FR-007, FR-009, FR-011, FR-012)
import { PROTOCOL_VERSION } from '@dagflow/protocol';
import { describe, expect, it } from 'vitest';
import { probe, type SocketLike } from '../../../src/engine-link/probe';

class FakeSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(public url: string) {}
  send(text: string) {
    this.sent.push(text);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  reply(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  fail() {
    this.onerror?.();
    this.onclose?.();
  }
}

function setup(opts: { pageSecure?: boolean; blocked?: (url: string) => boolean } = {}) {
  const sockets: FakeSocket[] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let seq = 0;
  const deps = {
    pageSecure: opts.pageSecure ?? false,
    createSocket: (url: string) => {
      if (opts.blocked?.(url)) throw new DOMException('insecure', 'SecurityError');
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    setTimer: (fn: () => void, ms: number) => {
      timers.set(++seq, { fn, ms });
      return seq;
    },
    clearTimer: (id: number) => {
      timers.delete(id);
    },
  };
  /** Сработать всем таймерам (истекли 3 с). */
  const elapse = () => {
    const all = [...timers.values()];
    timers.clear();
    for (const t of all) t.fn();
  };
  return { deps, sockets, timers, elapse };
}

const welcome = { type: 'welcome', protocol: PROTOCOL_VERSION, engine: '0.1.0' };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('probe', () => {
  it('успех только после welcome: hello отправлен, канал и схема в результате', async () => {
    const { deps, sockets } = setup();
    const p = probe('localhost:8080', {}, deps);
    expect(sockets[0]!.url).toBe('ws://localhost:8080');
    sockets[0]!.open();
    expect(JSON.parse(sockets[0]!.sent[0]!)).toMatchObject({ type: 'hello' });
    sockets[0]!.reply(welcome);
    const r = await p.result;
    expect(r).toMatchObject({ ok: true, scheme: 'ws', engine: '0.1.0', encrypted: false });
  });

  it('попытки строго по очереди: wss — только после закрытия ws', async () => {
    const { deps, sockets } = setup();
    const p = probe('localhost:8080', {}, deps);
    expect(sockets).toHaveLength(1);
    sockets[0]!.fail();
    expect(sockets[0]!.closed).toBe(true);
    expect(sockets.map((s) => s.url)).toEqual(['ws://localhost:8080', 'wss://localhost:8080']);
    sockets[1]!.open();
    sockets[1]!.reply(welcome);
    expect(await p.result).toMatchObject({ ok: true, scheme: 'wss', encrypted: true });
  });

  it('нет открытия за 3 с → следующая схема; все неудачны → unreachable (FR-012)', async () => {
    const { deps, sockets, timers, elapse } = setup();
    const p = probe('localhost:8080', {}, deps);
    expect([...timers.values()].map((t) => t.ms)).toEqual([3000]);
    elapse();
    expect(sockets[0]!.closed).toBe(true);
    elapse();
    expect(await p.result).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('сокет открыт, но welcome нет за 3 с → неудача («молчит»)', async () => {
    const { deps, sockets, elapse } = setup();
    const p = probe('localhost:8080', { hint: 'ws' }, deps);
    sockets[0]!.open();
    elapse();
    sockets[1]!.fail();
    expect(await p.result).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('ответ не welcome («не engine») → неудача этой схемы', async () => {
    const { deps, sockets } = setup();
    const p = probe('localhost:8080', {}, deps);
    sockets[0]!.open();
    sockets[0]!.onmessage?.({ data: 'HTTP/1.1 200 OK' });
    expect(sockets[0]!.closed).toBe(true);
    sockets[1]!.fail();
    expect(await p.result).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('другая версия протокола → incompatible с версиями хоста, без следующей схемы', async () => {
    const { deps, sockets } = setup();
    const p = probe('localhost:8080', {}, deps);
    sockets[0]!.open();
    sockets[0]!.reply({ ...welcome, protocol: PROTOCOL_VERSION + 1, engine: '0.9.0' });
    expect(await p.result).toEqual({
      ok: false,
      reason: 'incompatible',
      host: { protocol: PROTOCOL_VERSION + 1, engine: '0.9.0' },
    });
    expect(sockets).toHaveLength(1);
  });

  it('схема ws:// со страницы по https: ws бросает синхронно, wss не удался → blocked (FR-011)', async () => {
    // Как в настоящем браузере: синхронно бросает только ws (mixed content), wss — нет
    const { deps, sockets } = setup({ pageSecure: true, blocked: (url) => url.startsWith('ws:') });
    const p = probe('domain.com', { hint: 'ws' }, { ...deps, pageSecure: true });
    sockets[0]!.fail();
    expect(sockets.map((s) => s.url)).toEqual(['wss://domain.com']);
    expect(await p.result).toEqual({ ok: false, reason: 'blocked' });
  });

  it('страница по https и адрес не локальный — пробуется только wss; неудача → blocked (нужен wss-адрес)', async () => {
    const { deps, sockets } = setup({ pageSecure: true });
    const p = probe('domain.com', {}, deps);
    sockets[0]!.fail();
    expect(sockets.map((s) => s.url)).toEqual(['wss://domain.com']);
    expect(await p.result).toEqual({ ok: false, reason: 'blocked' });
  });

  it('страница по https, локальный адрес: обе схемы не удались → unreachable', async () => {
    const { deps, sockets } = setup({ pageSecure: true });
    const p = probe('localhost:8080', {}, deps);
    sockets[0]!.fail();
    sockets[1]!.fail();
    expect(await p.result).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('cancel закрывает сокет и завершает попытку как cancelled (FR-007)', async () => {
    const { deps, sockets } = setup();
    const p = probe('localhost:8080', {}, deps);
    p.cancel();
    expect(sockets[0]!.closed).toBe(true);
    expect(await p.result).toEqual({ ok: false, reason: 'cancelled' });
    await tick();
    expect(sockets).toHaveLength(1);
  });

  it('канал после успеха: сообщения идут в onMessage, закрытие — в onClose', async () => {
    const { deps, sockets } = setup();
    const p = probe('localhost:8080', {}, deps);
    sockets[0]!.open();
    sockets[0]!.reply(welcome);
    const r = await p.result;
    if (!r.ok) throw new Error('expected ok');
    const got: string[] = [];
    let closed = '';
    r.channel.onMessage = (t) => got.push(t);
    r.channel.onClose = (reason) => (closed = reason);
    sockets[0]!.reply({ type: 'pending', doc: 't', rev: 1, nodes: [] });
    r.channel.send('x');
    sockets[0]!.onclose?.();
    expect(got).toHaveLength(1);
    expect(sockets[0]!.sent.at(-1)).toBe('x');
    expect(closed).toBe('closed');
  });

  describe('разрешение Local Network Access (FR-011, FR-012, research R8)', () => {
    const flush = () => new Promise((r) => setTimeout(r, 0));

    it('denied → lna-denied, подключения нет', async () => {
      const { deps, sockets } = setup();
      const p = probe('localhost:8080', {}, { ...deps, permission: async () => 'denied' });
      expect(await p.result).toEqual({ ok: false, reason: 'lna-denied' });
      expect(sockets).toHaveLength(0);
    });

    it('prompt → подсказка, открытие сокета ждёт пользователя без таймаута; welcome — по-прежнему 3 с', async () => {
      const { deps, sockets, timers } = setup();
      let prompted = false;
      const p = probe(
        'localhost:8080',
        { onPrompt: () => (prompted = true) },
        { ...deps, permission: async () => 'prompt' },
      );
      await flush();
      expect(prompted).toBe(true);
      expect(sockets).toHaveLength(1);
      expect(timers.size).toBe(0);
      sockets[0]!.open();
      expect([...timers.values()].map((t) => t.ms)).toEqual([3000]);
      sockets[0]!.reply(welcome);
      expect(await p.result).toMatchObject({ ok: true });
    });

    it('granted или неизвестно → обычный путь с таймаутом', async () => {
      for (const state of ['granted', undefined] as const) {
        const { deps, sockets, timers } = setup();
        probe('localhost:8080', {}, { ...deps, permission: async () => state });
        await flush();
        expect(sockets).toHaveLength(1);
        expect(timers.size).toBe(1);
      }
    });

    it('ошибка запроса разрешения → обычный путь', async () => {
      const { deps, sockets } = setup();
      probe(
        'localhost:8080',
        {},
        { ...deps, permission: () => Promise.reject(new TypeError('x')) },
      );
      await flush();
      expect(sockets).toHaveLength(1);
    });
  });
});
