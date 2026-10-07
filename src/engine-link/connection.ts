// Текущая цель и пробная смена цели (FR-007, data-model «Пробное подключение»). Без таймеров внутри.
import type { Channel } from '@dagflow/protocol';
import type { Scheme } from './address';
import type { ProbeResult } from './probe';
import type { EngineTarget, Trial } from './types';

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
  /** Начальное подключение не удалось (сохранённая цель недоступна) — US3. */
  unavailable(target: EngineTarget, result: Exclude<OpenResult, { ok: true }>): void;
}

export interface ConnectionDeps {
  /** Открыть цель: Local — сразу, Server — проба схем. */
  open(target: EngineTarget, opts: { hint?: Scheme; remembered?: Scheme }): Opening;
}

export interface Connection {
  /** Ручная смена цели: пробная — текущая работает, пока новая не подтвердит (FR-007). */
  select(target: EngineTarget, opts?: { hint?: Scheme; remembered?: Scheme }): void;
  /** Начальное подключение (без пробной попытки): неудача → unavailable. */
  start(target: EngineTarget, opts?: { remembered?: Scheme }): void;
  dispose(): void;
}

export function createConnection(deps: ConnectionDeps, events: ConnectionEvents): Connection {
  let current: Channel | null = null;
  let pending: Opening | null = null;

  function detachCurrent() {
    if (!current) return;
    const old = current;
    current = null;
    old.onMessage = () => {};
    old.onClose = () => {};
    old.close();
  }

  function attach(r: Extract<OpenResult, { ok: true }>, target: EngineTarget) {
    detachCurrent();
    current = r.channel;
    const probed = 'welcome' in r ? r : undefined;
    events.attach(r.channel, probed?.welcome, {
      target,
      scheme: probed?.scheme,
      encrypted: probed?.encrypted ?? false,
    });
  }

  /** Новая попытка отменяет незавершённую (FR-007). */
  function run(
    target: EngineTarget,
    opts: { hint?: Scheme; remembered?: Scheme },
    done: (r: OpenResult) => void,
  ) {
    pending?.cancel();
    pending = null;
    const opening = deps.open(target, opts);
    if (opening.immediate) {
      done(opening.immediate);
      return;
    }
    pending = opening;
    void opening.result.then((r) => {
      if (pending !== opening) return;
      pending = null;
      if (r.ok || r.reason !== 'cancelled') done(r);
    });
  }

  return {
    select(target, opts = {}) {
      events.trial({ target, phase: 'probing' });
      run(target, opts, (r) => {
        if (r.ok) {
          attach(r, target);
          events.trial(undefined);
          return;
        }
        events.trial({
          target,
          phase: 'probing',
          // cancelled сюда не доходит (run его отбрасывает)
          failure: r.reason === 'cancelled' ? 'unreachable' : r.reason,
          ...(r.reason === 'incompatible' ? { host: r.host } : {}),
        });
      });
    },
    start(target, opts = {}) {
      run(target, opts, (r) => (r.ok ? attach(r, target) : events.unavailable(target, r)));
    },
    dispose() {
      pending?.cancel();
      pending = null;
      detachCurrent();
    },
  };
}
