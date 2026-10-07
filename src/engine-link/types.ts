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
  /** Фоновый поток упал 3 раза за минуту. */
  | { kind: 'failed' };

export interface Trial {
  target: EngineTarget;
  phase: 'probing';
  awaitingPermission?: boolean;
  /** Текст из contracts/ui-texts.md — у поля или строки. */
  error?: string;
}

export interface EngineSlice {
  target: EngineTarget;
  recent: RecentServer[];
  status: ConnectionStatus;
  trial?: Trial;
  /** FR-024: что не отправлено из-за лимита — набор определений и вкладки. */
  tooLarge: { library: boolean; tabs: Record<string, true> };
}

export const LOCAL: EngineTarget = { kind: 'local' };

export function initialEngine(): EngineSlice {
  return {
    target: LOCAL,
    recent: [],
    status: { kind: 'connecting' },
    tooLarge: { library: false, tabs: {} },
  };
}
