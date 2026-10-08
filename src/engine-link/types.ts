// Цель вычисления и состояние подключения (data-model.md фичи 004)

export type EngineTarget =
  | { kind: 'local' }
  | { kind: 'worker' }
  /** Адрес — как ввёл пользователь, после нормализации (research R9). */
  | { kind: 'server'; address: string };

export interface RecentServer {
  address: string;
  /** Способ, с которым подключение удалось в последний раз. */
  scheme?: 'ws' | 'wss';
}

export type ConnectionStatus =
  | { kind: 'connecting'; awaitingPermission?: boolean }
  | { kind: 'ready'; engine: string; encrypted: boolean }
  /** retryAt — время следующей попытки по часам адаптера. */
  | { kind: 'offline'; attempt: number; retryAt: number }
  | { kind: 'incompatible'; host: { protocol: number; engine: string } }
  /**
   * Без повторов: фоновый поток упал 3 раза за минуту; no-worker — в браузере нет Worker;
   * lna-denied — браузер запретил доступ к локальной сети (FR-011).
   */
  | { kind: 'failed'; reason?: 'no-worker' | 'lna-denied' };

export interface Trial {
  target: EngineTarget;
  phase: 'probing';
  awaitingPermission?: boolean;
  /** Причина неудачи; текст у поля или строки — из src/ui/messages.ts (contracts/ui-texts.md). */
  failure?:
    'unreachable' | 'blocked' | 'incompatible' | 'invalid-address' | 'no-worker' | 'lna-denied';
  /** Версии хоста при failure: 'incompatible'. */
  host?: { protocol: number; engine: string };
}

export interface EngineSlice {
  target: EngineTarget;
  recent: RecentServer[];
  status: ConnectionStatus;
  trial?: Trial;
  /** FR-024: что не отправлено из-за лимита — набор определений и вкладки. */
  tooLarge: { library: boolean; tabs: Record<string, true> };
  /** FR-013a: байты обмена с текущей целью — передано (tx) и принято (rx). */
  traffic: { tx: number; rx: number };
}

export const LOCAL: EngineTarget = { kind: 'local' };

export function initialEngine(): EngineSlice {
  return {
    target: LOCAL,
    recent: [],
    status: { kind: 'connecting' },
    tooLarge: { library: false, tabs: {} },
    traffic: { tx: 0, rx: 0 },
  };
}
