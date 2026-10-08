// Список серверов: до 5, в порядке добавления — строки не перемещаются (FR-003 – FR-005, уточнено 2026-10-08)
import type { Scheme } from './address';
import type { EngineTarget, RecentServer } from './types';

export const MAX_RECENT = 5;

/**
 * Успешное подключение: новый сервер — в конец (при переполнении уходит добавленный раньше всех);
 * уже записанный остаётся на месте, обновляется только запомненная схема.
 */
export function rememberServer(
  recent: RecentServer[],
  address: string,
  scheme?: Scheme,
): RecentServer[] {
  const index = recent.findIndex((r) => r.address === address);
  if (index >= 0) {
    if (!scheme || recent[index]!.scheme === scheme) return recent;
    return recent.map((r, i) => (i === index ? { address, scheme } : r));
  }
  const entry: RecentServer = scheme ? { address, scheme } : { address };
  return [...recent, entry].slice(-MAX_RECENT);
}

/** «×» у невыбранного сервера; выбранный убрать нельзя (spec, Assumptions). */
export function removeServer(
  recent: RecentServer[],
  address: string,
  selected: EngineTarget,
): RecentServer[] {
  if (selected.kind === 'server' && selected.address === address) return recent;
  if (!recent.some((r) => r.address === address)) return recent;
  return recent.filter((r) => r.address !== address);
}
