// Подключение к цели: пробная смена (FR-007) и переподключение (FR-020 – FR-022a, data-model).
// Часы, таймеры и случайность передаются извне — машина состояний тестируется без ожиданий.
import type { Channel } from '@dagflow/protocol';
import type { Scheme } from './address';
import type { ProbeResult } from './probe';
import type { ConnectionStatus, EngineTarget, Trial } from './types';

/** Открытие Local: канал без welcome — клиент протокола сам отправит hello. */
export type LocalOk = { ok: true; channel: Channel };
export type OpenResult = ProbeResult | LocalOk;

export interface Opening {
  result: Promise<OpenResult>;
  cancel(): void;
  /** Результат уже известен (Local): подключение синхронное — как вычисление в окне раньше. */
  immediate?: OpenResult;
}

export interface AttachInfo {
  target: EngineTarget;
  scheme?: Scheme;
  encrypted: boolean;
}

export interface ConnectionEvents {
  /** Новый текущий канал. welcome — если его уже получила проба (второй hello не нужен). */
  attach(channel: Channel, welcome: string | undefined, info: AttachInfo): void;
  /** Пробная попытка: идёт, не удалась или закончилась (undefined). */
  trial(trial: Trial | undefined): void;
  /** Состояние, которое знает только подключение: offline, connecting (повтор), incompatible. */
  status(status: ConnectionStatus): void;
}

export interface ConnectionDeps {
  /** Открыть цель: Local — сразу, Server — проба схем. */
  open(target: EngineTarget, opts: { hint?: Scheme; remembered?: Scheme }): Opening;
  now(): number;
  /** [0, 1) — разброс паузы, чтобы вкладки не стучались одновременно. */
  random(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export interface Connection {
  /** Ручная смена цели: пробная — текущая работает, пока новая не подтвердит (FR-007). */
  select(target: EngineTarget, opts?: { hint?: Scheme; remembered?: Scheme }): void;
  /** Начальное подключение к сохранённой цели: неудача → offline и повторы (FR-022). */
  start(target: EngineTarget, opts?: { remembered?: Scheme }): void;
  /** «Retry now», событие online: попытка сразу (FR-020). */
  retryNow(): void;
  /** «Use local engine»: Local сразу, повторы к прежней цели прекращаются (FR-022a). */
  useLocal(): void;
  /** Цель другой версии протокола: закрытие канала — не обрыв, повторов нет (FR-023). */
  halt(): void;
  dispose(): void;
}

/** Пауза перед попыткой n: min(500 · 2^(n-1) · (1 ± 0,2), 10 000) мс (data-model, R7). */
export function retryDelay(attempt: number, random: number): number {
  const base = 500 * 2 ** (attempt - 1);
  return Math.round(Math.min(base * (1 + (random * 0.4 - 0.2)), 10_000));
}

export function createConnection(deps: ConnectionDeps, events: ConnectionEvents): Connection {
  let current: Channel | null = null;
  /** Цель текущего канала — к ней переподключаемся после обрыва. */
  let target: EngineTarget | null = null;
  let scheme: Scheme | undefined;
  let trial: Opening | null = null;
  let retry: Opening | null = null;
  let timer: unknown = null;
  let attempt = 0;
  let halted = false;

  function stopRetries() {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
    retry?.cancel();
    retry = null;
    attempt = 0;
  }

  function detachCurrent() {
    if (!current) return;
    const old = current;
    current = null;
    old.onMessage = () => {};
    old.onClose = () => {};
    old.close();
  }

  function attach(r: Extract<OpenResult, { ok: true }>, next: EngineTarget) {
    stopRetries();
    detachCurrent();
    halted = false;
    current = r.channel;
    target = next;
    const probed = 'welcome' in r ? r : undefined;
    scheme = probed?.scheme;
    const channel = r.channel;
    channel.onClose = () => {
      if (current !== channel) return;
      current = null;
      if (!halted) scheduleRetry();
    };
    events.attach(channel, probed?.welcome, {
      target: next,
      scheme,
      encrypted: probed?.encrypted ?? false,
    });
  }

  function scheduleRetry() {
    attempt += 1;
    const delay = retryDelay(attempt, deps.random());
    events.status({ kind: 'offline', attempt, retryAt: deps.now() + delay });
    timer = deps.setTimer(() => {
      timer = null;
      reconnect();
    }, delay);
  }

  /** Попытка к текущей цели (повтор или старт). */
  function reconnect(opts: { remembered?: Scheme } = { remembered: scheme }) {
    if (!target || retry) return;
    if (attempt > 0) events.status({ kind: 'connecting' });
    const next = target;
    const opening = deps.open(next, opts);
    if (opening.immediate) return onRetry(opening.immediate, next);
    retry = opening;
    void opening.result.then((r) => {
      if (retry !== opening) return;
      retry = null;
      onRetry(r, next);
    });
  }

  function onRetry(r: OpenResult, next: EngineTarget) {
    if (r.ok) return attach(r, next);
    if (r.reason === 'cancelled') return;
    if (r.reason === 'incompatible') {
      halted = true;
      stopRetries();
      events.status({ kind: 'incompatible', host: r.host });
      return;
    }
    scheduleRetry();
  }

  function select(next: EngineTarget, opts: { hint?: Scheme; remembered?: Scheme } = {}) {
    // Новая попытка отменяет незавершённую (FR-007); повторы к прежней цели идут дальше
    trial?.cancel();
    trial = null;
    events.trial({ target: next, phase: 'probing' });
    const done = (r: OpenResult) => {
      if (r.ok) {
        attach(r, next);
        events.trial(undefined);
        return;
      }
      if (r.reason === 'cancelled') return;
      events.trial({
        target: next,
        phase: 'probing',
        failure: r.reason,
        ...(r.reason === 'incompatible' ? { host: r.host } : {}),
      });
    };
    const opening = deps.open(next, opts);
    if (opening.immediate) return done(opening.immediate);
    trial = opening;
    void opening.result.then((r) => {
      if (trial !== opening) return;
      trial = null;
      done(r);
    });
  }

  return {
    select,

    start(next, opts = {}) {
      target = next;
      scheme = opts.remembered;
      reconnect({ remembered: opts.remembered });
    },

    retryNow() {
      if (current || halted || retry || !target) return;
      if (timer !== null) deps.clearTimer(timer);
      timer = null;
      reconnect();
    },

    useLocal() {
      stopRetries();
      halted = true;
      select({ kind: 'local' });
    },

    halt() {
      halted = true;
      stopRetries();
    },

    dispose() {
      trial?.cancel();
      trial = null;
      stopRetries();
      halted = true;
      detachCurrent();
    },
  };
}
