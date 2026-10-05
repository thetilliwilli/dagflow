// Соединение портов с объяснением отказа (FR-004, FR-005a, SC-004)
import type { PortRef } from '../../engine';
import type { Actions } from '../../store/actions';

/** Пытается создать связь; при отказе показывает уведомление с причиной. */
export function tryConnect(actions: Actions, source: PortRef, target: PortRef): boolean {
  const r = actions.connect(source, target);
  if (!r.ok) actions.notify('error', r.message);
  return r.ok;
}
