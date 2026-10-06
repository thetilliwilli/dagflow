// Пучки связей: все связи от нода A к ноду B рисуются одной линией (FR-023, FR-024; research R2)
import type { Edge } from '../../engine';
import { edgeMessages } from '../messages';

export interface Bundle {
  /** `bundle:<source>-><target>` — id ребра React Flow. */
  id: string;
  source: string;
  target: string;
  /** Связи пары в порядке графа. */
  edges: Edge[];
}

/** Сколько строк подписи показывать, остальные — «ещё N». */
export const LABEL_MAX_LINES = 5;

export function bundleId(source: string, target: string): string {
  return `bundle:${source}->${target}`;
}

/**
 * Один пучок на упорядоченную пару нодов. Обратных пучков (B → A при A → B) не бывает:
 * это был бы цикл, который движок запрещает.
 */
export function bundleEdges(edges: Edge[]): Bundle[] {
  const byId = new Map<string, Bundle>();
  for (const e of edges) {
    const id = bundleId(e.source.node, e.target.node);
    const b = byId.get(id);
    if (b) b.edges.push(e);
    else byId.set(id, { id, source: e.source.node, target: e.target.node, edges: [e] });
  }
  return [...byId.values()];
}

/** Строки подписи: «выход→вход», не больше LABEL_MAX_LINES, затем «ещё N». */
export function bundleLabel(bundle: Bundle, max = LABEL_MAX_LINES): string[] {
  const shown = bundle.edges
    .slice(0, max)
    .map((e) => edgeMessages.link(e.source.port, e.target.port));
  const rest = bundle.edges.length - shown.length;
  return rest > 0 ? [...shown, edgeMessages.more(rest)] : shown;
}
