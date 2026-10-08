// Пробное подключение к серверу: перебор схем по очереди, hello → welcome (FR-007 – FR-012, R8)
import { ENGINE_VERSION } from '@dagflow/engine';
import { PROTOCOL_VERSION, type Channel } from '@dagflow/protocol';
import { isLocalHost, schemeOrder, toUrl, type Scheme } from './address';
import { createWebSocketChannel, type SocketLike } from './channels/websocket';

export type { SocketLike } from './channels/websocket';

/** Таймаут открытия сокета и ожидания welcome (FR-012). */
export const PROBE_TIMEOUT_MS = 3000;

export type ProbeResult =
  | {
      ok: true;
      channel: Channel;
      scheme: Scheme;
      engine: string;
      encrypted: boolean;
      /** Полученный welcome — его обрабатывает клиент протокола вместо повторного hello. */
      welcome: string;
    }
  | { ok: false; reason: 'unreachable' | 'blocked' | 'cancelled' | 'lna-denied' }
  | { ok: false; reason: 'incompatible'; host: { protocol: number; engine: string } };

export interface ProbeDeps {
  pageSecure: boolean;
  /** Может бросить синхронно (браузер запрещает подключение — mixed content). */
  createSocket(url: string): SocketLike;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /**
   * Состояние разрешения браузера на доступ к localhost / локальной сети (Local Network Access,
   * research R8); undefined — браузер такого разрешения не знает.
   */
  permission?(address: string): Promise<'granted' | 'prompt' | 'denied' | undefined>;
}

export type PermissionState = 'granted' | 'prompt' | 'denied' | undefined;

export interface Probe {
  result: Promise<ProbeResult>;
  cancel(): void;
}

export function probe(
  address: string,
  opts: { hint?: Scheme; remembered?: Scheme; onPrompt?: () => void },
  deps: ProbeDeps,
): Probe {
  const schemes = schemeOrder(address, { pageSecure: deps.pageSecure, ...opts });
  let resolve!: (r: ProbeResult) => void;
  const result = new Promise<ProbeResult>((r) => (resolve = r));
  let done = false;
  let current: SocketLike | null = null;
  let timer: unknown;
  let blocked = 0;
  /** Браузер спрашивает разрешение: открытие сокета ждёт пользователя — без таймаута (FR-012). */
  let waitForUser = false;

  function finish(r: ProbeResult) {
    if (done) return;
    done = true;
    deps.clearTimer(timer);
    resolve(r);
  }

  function attempt(index: number) {
    if (done) return;
    const scheme = schemes[index];
    if (!scheme) {
      // Со страницы по https к не локальному адресу браузер пускает только wss: если и он не
      // удался, объясняем, что серверу нужен защищённый адрес (FR-011); так же — если браузер
      // синхронно запретил какую-то схему. Причину неудачи wss скрипт не видит (research R8)
      const secureOnly = deps.pageSecure && !isLocalHost(address);
      finish({ ok: false, reason: blocked > 0 || secureOnly ? 'blocked' : 'unreachable' });
      return;
    }
    let socket: SocketLike;
    try {
      socket = deps.createSocket(toUrl(address, scheme));
    } catch {
      blocked += 1;
      attempt(index + 1);
      return;
    }
    current = socket;
    let settled = false;
    // Неудача этой схемы: закрыть сокет и только потом пробовать следующую (RFC 6455, одна CONNECTING)
    const next = () => {
      if (settled || done) return;
      settled = true;
      deps.clearTimer(timer);
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      current = null;
      attempt(index + 1);
    };
    if (!waitForUser) timer = deps.setTimer(next, PROBE_TIMEOUT_MS);
    socket.onerror = next;
    socket.onclose = next;
    socket.onopen = () => {
      deps.clearTimer(timer);
      timer = deps.setTimer(next, PROBE_TIMEOUT_MS);
      socket.send(
        JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, engine: ENGINE_VERSION }),
      );
    };
    socket.onmessage = (e) => {
      const text = String(e.data);
      let msg: { type?: unknown; protocol?: unknown; engine?: unknown };
      try {
        msg = JSON.parse(text);
      } catch {
        return next();
      }
      if (msg.type !== 'welcome' || typeof msg.protocol !== 'number') return next();
      settled = true;
      const engine = typeof msg.engine === 'string' ? msg.engine : '?';
      if (msg.protocol !== PROTOCOL_VERSION) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
        socket.close();
        finish({ ok: false, reason: 'incompatible', host: { protocol: msg.protocol, engine } });
        return;
      }
      socket.onopen = null;
      finish({
        ok: true,
        channel: createWebSocketChannel(socket),
        scheme,
        engine,
        encrypted: scheme === 'wss',
        welcome: text,
      });
    };
  }

  if (!deps.permission) attempt(0);
  else {
    const query = deps.permission(address).catch((): PermissionState => undefined);
    void query.then((state) => {
      if (done) return;
      if (state === 'denied') return finish({ ok: false, reason: 'lna-denied' });
      if (state === 'prompt') {
        waitForUser = true;
        opts.onPrompt?.();
      }
      attempt(0);
    });
  }
  return {
    result,
    cancel() {
      if (done) return;
      if (current) {
        current.onopen = current.onmessage = current.onerror = current.onclose = null;
        current.close();
      }
      finish({ ok: false, reason: 'cancelled' });
    },
  };
}
