// Цель «Worker»: хост протокола в модульном фоновом потоке (research R14)
import { ENGINE_VERSION } from '@dagflow/engine';
import { PROTOCOL_VERSION, type Channel } from '@dagflow/protocol';
import type { Opening, OpenResult } from '../connection';
import { PROBE_TIMEOUT_MS } from '../probe';

/** То, что нужно от Worker (в тестах — подделка). */
export interface WorkerLike {
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onmessageerror: (() => void) | null;
  postMessage(text: string): void;
  terminate(): void;
}

export interface WorkerTimers {
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

/** Канал поверх запущенного потока. Ошибка потока → завершить его и onClose('crashed'). */
function workerChannel(worker: WorkerLike): Channel {
  let closed = false;
  const finish = (reason: 'closed' | 'crashed') => {
    if (closed) return;
    closed = true;
    worker.terminate();
    channel.onClose(reason);
  };
  const channel: Channel = {
    onMessage: () => {},
    onClose: () => {},
    send(text) {
      if (!closed) worker.postMessage(text);
    },
    close: () => finish('closed'),
  };
  worker.onmessage = (e) => {
    if (!closed) channel.onMessage(String(e.data));
  };
  worker.onerror = () => finish('crashed');
  worker.onmessageerror = () => finish('crashed');
  return channel;
}

/**
 * Запустить поток и дождаться welcome (как проба сервера: цель подтверждает, что это engine).
 * `create` бросает, если Worker в браузере нет.
 */
export function openWorker(create: () => WorkerLike, timers: WorkerTimers): Opening {
  let worker: WorkerLike;
  try {
    worker = create();
  } catch {
    const failed: OpenResult = { ok: false, reason: 'no-worker' };
    return { immediate: failed, result: Promise.resolve(failed), cancel: () => {} };
  }
  const hello = JSON.stringify({
    type: 'hello',
    protocol: PROTOCOL_VERSION,
    engine: ENGINE_VERSION,
  });
  let resolve!: (r: OpenResult) => void;
  const result = new Promise<OpenResult>((r) => (resolve = r));
  let done = false;
  const stop = (r: OpenResult) => {
    if (done) return;
    done = true;
    timers.clearTimer(timer);
    worker.onmessage = worker.onerror = worker.onmessageerror = null;
    worker.terminate();
    resolve(r);
  };
  const fail = () => stop({ ok: false, reason: 'unreachable' });
  const timer = timers.setTimer(fail, PROBE_TIMEOUT_MS);
  worker.onerror = fail;
  worker.onmessageerror = fail;
  worker.onmessage = (e) => {
    if (done) return;
    const text = String(e.data);
    let msg: { type?: unknown; protocol?: unknown; engine?: unknown };
    try {
      msg = JSON.parse(text);
    } catch {
      return fail();
    }
    if (msg.type !== 'welcome' || msg.protocol !== PROTOCOL_VERSION) return fail();
    done = true;
    timers.clearTimer(timer);
    resolve({
      ok: true,
      channel: workerChannel(worker),
      engine: typeof msg.engine === 'string' ? msg.engine : '?',
      welcome: text,
      hello,
    });
  };
  worker.postMessage(hello);
  return { result, cancel: () => stop({ ok: false, reason: 'cancelled' }) };
}
