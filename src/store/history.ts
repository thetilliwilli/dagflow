// История отмены: снапшоты графа на вкладку (research R5, FR-009). Только в памяти.
import type { Graph } from '../engine';

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 500;

export interface TabHistory {
  past: Graph[];
  future: Graph[];
  /** Ключ последней правки: серия правок с тем же ключом быстрее 500 мс — один шаг. */
  lastKey: string | null;
  lastAt: number;
}

export const emptyHistory = (): TabHistory => ({ past: [], future: [], lastKey: null, lastAt: 0 });

/** Записать состояние графа до правки. */
export function record(h: TabHistory | undefined, before: Graph, key: string | null, now: number): TabHistory {
  const base = h ?? emptyHistory();
  if (key !== null && base.lastKey === key && now - base.lastAt < COALESCE_MS) {
    return { ...base, future: [], lastAt: now };
  }
  return { past: [...base.past, before].slice(-HISTORY_LIMIT), future: [], lastKey: key, lastAt: now };
}

export function undo(h: TabHistory | undefined, current: Graph): { history: TabHistory; graph: Graph } | null {
  if (!h || h.past.length === 0) return null;
  const graph = h.past[h.past.length - 1]!;
  return { graph, history: { past: h.past.slice(0, -1), future: [...h.future, current], lastKey: null, lastAt: 0 } };
}

export function redo(h: TabHistory | undefined, current: Graph): { history: TabHistory; graph: Graph } | null {
  if (!h || h.future.length === 0) return null;
  const graph = h.future[h.future.length - 1]!;
  return { graph, history: { past: [...h.past, current], future: h.future.slice(0, -1), lastKey: null, lastAt: 0 } };
}
